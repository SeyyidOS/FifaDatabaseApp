#!/usr/bin/env bash
# Publish or update FIFA Manager on this server, next to the other sites behind Caddy:
#   1. create any missing secrets in $BASE/secrets.env (never committed),
#   2. back up the database, then build the images and (re)start fifa_db, fifa_api and fifa_web
#      (compose.public.yml); the API applies pending schema migrations when it starts,
#   3. insert/refresh the site block (Caddyfile.fifa) in the shared Caddy config, validated first,
#   4. reload Caddy without a restart (the other sites keep running) and smoke-test the public URL.
# Usage: deploy/deploy.sh                publish or update (safe to re-run)
#        deploy/deploy.sh --import FILE  load a plain SQL dump into the empty database, then publish
#        deploy/deploy.sh --backup       write a compressed database dump to $BASE/backups
#        deploy/deploy.sh --passwords    print the first passwords of the "main" board
#        deploy/deploy.sh --admin-key    print the server admin key (admin on every board)
#        deploy/deploy.sh --remove       unpublish (removes the site block and containers; data stays)
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
BASE=${FIFA_BASE:-/root/programs/fifa-app}
SECRETS="$BASE/secrets.env"
CADDYFILE=${CADDYFILE:-/root/programs/mlflow/caddy/Caddyfile}
CADDY=${CADDY_CONTAINER:-mlflow_tls_proxy}
BEGIN="# >>> fifa-app (managed by fifa-app/deploy/deploy.sh)"
END="# <<< fifa-app"
DOMAIN=$(awk '/^[^#[:space:]].*\{$/ {print $1; exit}' "$HERE/Caddyfile.fifa")
export FIFA_BASE="$BASE"
COMPOSE=(docker compose -f "$HERE/compose.public.yml" --env-file "$SECRETS")

# current Caddyfile without our block
without_block() { awk -v b="$BEGIN" -v e="$END" '$0==b{skip=1} !skip{print} $0==e{skip=0}' "$CADDYFILE" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}'; }

install_caddyfile() {  # $1 = candidate content
    local candidate=$1
    # validate inside the Caddy container (same version and env) before touching the live file
    printf '%s\n' "$candidate" | docker exec -i "$CADDY" sh -c 'cat > /tmp/Caddyfile.candidate'
    docker exec "$CADDY" caddy validate --config /tmp/Caddyfile.candidate --adapter caddyfile >/dev/null
    cp -p "$CADDYFILE" "$CADDYFILE.bak.$(date +%Y%m%d-%H%M%S)"
    # write in place: the file is a single-file bind mount, replacing it (new inode) would hide it from Caddy
    printf '%s\n' "$candidate" > "$CADDYFILE"
    docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
}

random_text() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-"$1"; }

ensure_secret() {  # $1 = name, $2 = value to store if it is missing
    grep -q "^$1=" "$SECRETS" 2>/dev/null && return 0
    (umask 077 && echo "$1=$2" >> "$SECRETS")
    echo "==> added $1 to $SECRETS"
}

ensure_secrets() {
    mkdir -p "$BASE"
    chmod 700 "$BASE"
    ensure_secret POSTGRES_PASSWORD "$(openssl rand -hex 24)"
    ensure_secret ADMIN_KEY "$(random_text 16)"
    ensure_secret SECRET_KEY "$(openssl rand -hex 32)"          # signs the device tokens
    ensure_secret LEGACY_BOARD_PASSWORD "$(random_text 10)"     # first passwords of the "main" board
    ensure_secret LEGACY_BOARD_ADMIN_PASSWORD "$(random_text 12)"
    chmod 600 "$SECRETS"
    # shellcheck disable=SC1090
    source "$SECRETS"
    if [ -z "${POSTGRES_PASSWORD:-}" ] || [ "${#ADMIN_KEY}" -lt 12 ] || [ "${#SECRET_KEY}" -lt 32 ]; then
        echo "$SECRETS must set POSTGRES_PASSWORD, ADMIN_KEY (12+ characters) and SECRET_KEY (32+ characters)."
        exit 1
    fi
}

backup() {
    mkdir -p "$BASE/backups"
    local out
    out="$BASE/backups/fifa_db-$(date +%Y%m%d-%H%M%S).sql.gz"
    docker exec fifa_db pg_dump -U fifa --no-owner fifa_db | gzip > "$out"
    echo "$out"
}

wait_healthy() {  # $1 = container
    for _ in $(seq 1 60); do
        [ "$(docker inspect --format '{{.State.Health.Status}}' "$1" 2>/dev/null)" = healthy ] && return 0
        sleep 2
    done
    echo "$1 did not become healthy"
    docker logs --tail 40 "$1"
    return 1
}

smoke_test() {
    echo "==> checking https://$DOMAIN (the first request may wait for the certificate)"
    for _ in $(seq 1 30); do
        if curl -fsS --max-time 10 "https://$DOMAIN/api/health" 2>/dev/null | grep -q '"ok": *true'; then
            # board data must never be served without signing in
            local code
            code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/api/boards/main/players")
            [ "$code" = 401 ] || [ "$code" = 404 ] || { echo "board data answered $code without a token"; return 1; }
            echo "Live: https://$DOMAIN"
            return 0
        fi
        sleep 2
    done
    echo "https://$DOMAIN is not answering yet; check: docker logs --tail 50 $CADDY"
    return 1
}

IMPORT=""
case "${1:-}" in
    --admin-key)
        ensure_secrets
        echo "$ADMIN_KEY"
        exit 0
        ;;
    --passwords)
        ensure_secrets
        echo "Main board (https://$DOMAIN/#/b/main), as first set up:"
        echo "  board password: $LEGACY_BOARD_PASSWORD"
        echo "  admin password: $LEGACY_BOARD_ADMIN_PASSWORD"
        echo "If an admin changed them in Settings since, the new ones apply."
        exit 0
        ;;
    --backup)
        backup
        exit 0
        ;;
    --remove)
        ensure_secrets
        echo "==> removing the Caddy site block"
        install_caddyfile "$(without_block)"
        "${COMPOSE[@]}" down
        echo "Unpublished $DOMAIN (data kept in $BASE)."
        exit 0
        ;;
    --import)
        IMPORT=${2:?usage: deploy/deploy.sh --import FILE}
        [ -r "$IMPORT" ] || { echo "Cannot read $IMPORT"; exit 1; }
        ;;
    "") ;;
    *)
        sed -n '8,13p' "$0"
        exit 2
        ;;
esac

ensure_secrets

if [ -n "$IMPORT" ]; then
    echo "==> importing $IMPORT"
    "${COMPOSE[@]}" up -d db
    wait_healthy fifa_db
    if [ -n "$(docker exec fifa_db psql -U fifa -d fifa_db -tAc "select to_regclass('public.matches')")" ]; then
        echo "The database already has data; refusing to import over it."
        exit 1
    fi
    docker exec -i fifa_db psql -v ON_ERROR_STOP=1 -q -U fifa -d fifa_db < "$IMPORT"
fi

if [ "$(docker inspect --format '{{.State.Running}}' fifa_db 2>/dev/null)" = true ]; then
    echo "==> backing up the database before anything changes: $(backup)"
fi

# match photos are files (backend/photos.py), written by the API's user on an otherwise read-only container
mkdir -p "$BASE/photos"
chown 10001:10001 "$BASE/photos"
chmod 700 "$BASE/photos"

echo "==> building images and (re)starting fifa_db, fifa_api, fifa_web"
"${COMPOSE[@]}" up -d --build
wait_healthy fifa_api
wait_healthy fifa_web

echo "==> installing the Caddy site block for $DOMAIN"
install_caddyfile "$(without_block)

$BEGIN
$(cat "$HERE/Caddyfile.fifa")
$END"

smoke_test
