#!/usr/bin/env bash
# Practise getting the database back: loads a dump into a throwaway Postgres, prints how many rows each
# table has and the schema version, then removes it. The live database is never touched.
#
#   deploy/restore-drill.sh FILE.sql.gz                a dump on this server (backups/)
#   deploy/restore-drill.sh FILE.sql.gz.age KEY        one from R2, with the age private key file
#   deploy/restore-drill.sh --latest KEY               fetches the newest dump from R2 first
#                                                      (the R2_* settings, as deploy/offsite-backup.sh)
#
# A real restore is the same load into the live, emptied database (deploy/README.md, "Off-server backups").
set -euo pipefail

BASE=${FIFA_BASE:-/root/programs/fifa-app}
SECRETS=${SECRETS_FILE:-$BASE/secrets.env}
RCLONE_IMAGE=rclone/rclone:1.71.2
AGE_IMAGE=alpine:3.22
PG_IMAGE=postgres:16-alpine
DB=fifa-restore-drill-$$

usage() { sed -n '4,7p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
[ $# -ge 1 ] || usage

work=$(mktemp -d)
chmod 700 "$work"
cleanup() { docker rm -f "$DB" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

setting() {
    local name=$1
    if [ -n "${!name:-}" ]; then
        printf '%s' "${!name}"
    elif [ -f "$SECRETS" ]; then
        sed -n "s/^$name=//p" "$SECRETS" | tail -1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
    fi
}

if [ "$1" = --latest ]; then
    [ $# -eq 2 ] || usage
    key=$2
    for name in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET; do
        value=$(setting "$name")
        [ -n "$value" ] || { echo "$name is not set in $SECRETS" >&2; exit 1; }
        printf -v "$name" '%s' "$value"
    done
    endpoint=$(setting R2_ENDPOINT)
    cat > "$work/rclone.env" <<EOF
RCLONE_CONFIG_R2_TYPE=s3
RCLONE_CONFIG_R2_PROVIDER=Cloudflare
RCLONE_CONFIG_R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID
RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY
RCLONE_CONFIG_R2_ENDPOINT=${endpoint:-https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com}
RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
EOF
    rclone=(docker run --rm --network host --env-file "$work/rclone.env" -v "$work:/work" "$RCLONE_IMAGE" -q)
    newest=$("${rclone[@]}" lsf "r2:$R2_BUCKET/db/" | sort | tail -1)
    [ -n "$newest" ] || { echo "no dump in r2:$R2_BUCKET/db/" >&2; exit 1; }
    echo "==> fetching db/$newest"
    "${rclone[@]}" copyto "r2:$R2_BUCKET/db/$newest" "/work/$newest"
    file="$work/$newest"
else
    file=$1
    key=${2:-}
fi
[ -f "$file" ] || { echo "no such file: $file" >&2; exit 1; }

if [[ "$file" == *.age ]]; then
    [ -n "$key" ] && [ -f "$key" ] || { echo "an .age file needs the age private key file" >&2; exit 1; }
    echo "==> decrypting $(basename "$file")"
    docker run --rm -i -v "$(cd "$(dirname "$key")" && pwd)/$(basename "$key"):/key:ro" "$AGE_IMAGE" \
        sh -c 'apk add -q age >/dev/null && age -d -i /key' < "$file" > "$work/dump.sql.gz"
    file="$work/dump.sql.gz"
fi

echo "==> loading it into a throwaway Postgres ($DB)"
docker run -d --name "$DB" -e POSTGRES_USER=fifa -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=fifa_db "$PG_IMAGE" >/dev/null
for _ in $(seq 1 30); do
    docker exec "$DB" pg_isready -U fifa -d fifa_db >/dev/null 2>&1 && break
    sleep 1
done
sleep 1
gunzip -c "$file" | docker exec -i "$DB" psql -q -v ON_ERROR_STOP=1 -U fifa -d fifa_db >/dev/null

echo "==> rows per table"
docker exec "$DB" psql -U fifa -d fifa_db -At -F $'\t' -c "
    SELECT table_name,
           (xpath('/row/n/text()', query_to_xml(format('SELECT COUNT(*) AS n FROM %I', table_name), false, true, '')))[1]::text
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name" | column -t
echo "schema version: $(docker exec "$DB" psql -U fifa -d fifa_db -Atc 'SELECT MAX(version) FROM schema_version')"
echo "==> it loads; the throwaway database goes now"
