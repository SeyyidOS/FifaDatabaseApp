#!/usr/bin/env bash
# Copies the newest database dump and the photos off this server, to a Backblaze B2 bucket, so a lost
# disk or server doesn't take the leagues with it. Meant to run right after the nightly dump (root's
# crontab):
#
#   7 4 * * * …/deploy/deploy.sh --backup >> …/backups/cron.log 2>&1 && …/deploy/offsite-backup.sh >> …/backups/offsite.log 2>&1
#
# Everything is encrypted here, before it leaves, with age to BACKUP_AGE_RECIPIENT: the public key. The
# private key that opens it is kept off this server (deploy/README.md, "Off-server backups"). The bucket
# then holds:
#   db/fifa_db-YYYYMMDD-HHMMSS.sql.gz.age   the newest dump of each night, the last 30 kept
#   photos/photos-YYYYMMDD.tar.age          match and account photos as they were that night, the last 7
#
# It stays off until secrets.env has BACKUP_KEY_ID, BACKUP_KEY, BACKUP_BUCKET (backup-common.sh) and
# BACKUP_AGE_RECIPIENT; until then it says which is missing and exits 0. deploy/restore-drill.sh gets a
# dump back.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
BASE=${FIFA_BASE:-/root/programs/fifa-app}
SECRETS=${SECRETS_FILE:-$BASE/secrets.env}
KEEP_DUMPS=30
KEEP_PHOTOS=7
# shellcheck source=backup-common.sh
. "$HERE/backup-common.sh"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
chmod 700 "$work"

RECIPIENT=$(setting BACKUP_AGE_RECIPIENT)
if [ -z "$RECIPIENT" ] || ! missing=$(store_config "$work/rclone.env"); then
    echo "$(date -Is) off-server backup is off: ${missing:-BACKUP_AGE_RECIPIENT is not set in $SECRETS}"
    exit 0
fi
BUCKET=$(setting BACKUP_BUCKET)

dump=$(find "$BASE/backups" -maxdepth 1 -name 'fifa_db-*.sql.gz' 2>/dev/null | sort | tail -1)
if [ -z "$dump" ]; then
    echo "$(date -Is) no dump in $BASE/backups to copy" >&2
    exit 1
fi
mkdir "$work/out"

rclone() {
    docker run --rm --network host --env-file "$work/rclone.env" -v "$work/out:/out:ro" "$RCLONE_IMAGE" -q "$@"
}

encrypt() {  # stdin to stdout, for the recipient's private key only
    docker run --rm -i -e RECIPIENT="$RECIPIENT" "$AGE_IMAGE" sh -c 'apk add -q age >/dev/null && age -r "$RECIPIENT"'
}

# keeps the newest $2 files in folder $1 of the bucket (the names sort by date)
prune() {
    rclone lsf "store:$BUCKET/$1/" | sort | head -n -"$2" | while read -r old; do
        [ -n "$old" ] && rclone deletefile "store:$BUCKET/$1/$old" && echo "  removed $1/$old"
    done
}

night=$(date +%Y%m%d)
name="$(basename "$dump").age"
encrypt < "$dump" > "$work/out/$name"
rclone copyto "/out/$name" "store:$BUCKET/db/$name"
echo "$(date -Is) db/$name ($(du -h "$work/out/$name" | cut -f1))"

if [ -d "$BASE/photos" ]; then
    tar -C "$BASE" -cf - photos | encrypt > "$work/out/photos-$night.tar.age"
    rclone copyto "/out/photos-$night.tar.age" "store:$BUCKET/photos/photos-$night.tar.age"
    echo "$(date -Is) photos/photos-$night.tar.age ($(du -h "$work/out/photos-$night.tar.age" | cut -f1))"
fi

prune db "$KEEP_DUMPS"
prune photos "$KEEP_PHOTOS"
