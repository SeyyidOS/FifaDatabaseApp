# shellcheck shell=bash
# Shared by offsite-backup.sh and restore-drill.sh (sourced, not run): where their settings come from
# and how rclone reaches the backup store. Expects BASE and SECRETS to be set.
#
# The store is a Backblaze B2 bucket: BACKUP_KEY_ID and BACKUP_KEY (an application key for that bucket)
# and BACKUP_BUCKET. With BACKUP_S3_ENDPOINT set, any S3-compatible store is used instead, with the same
# key id, key and bucket (handy for trying it out against a local one).

# shellcheck disable=SC2034  # used by the scripts that source this
RCLONE_IMAGE=rclone/rclone:1.71.2
# shellcheck disable=SC2034
AGE_IMAGE=alpine:3.22

# a value from the environment, else from secrets.env ('' when neither has it); never printed
setting() {
    local name=$1
    if [ -n "${!name:-}" ]; then
        printf '%s' "${!name}"
    elif [ -f "$SECRETS" ]; then
        sed -n "s/^$name=//p" "$SECRETS" | tail -1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
    fi
}

# Writes rclone's settings for the remote "store:" to $1, a file only root can read: the keys reach
# rclone through it, never the command line. Says which setting is missing (return 1) when one is.
store_config() {
    local name value
    for name in BACKUP_KEY_ID BACKUP_KEY BACKUP_BUCKET; do
        value=$(setting "$name")
        if [ -z "$value" ]; then
            echo "$name is not set in $SECRETS"
            return 1
        fi
        printf -v "$name" '%s' "$value"
    done
    local endpoint
    endpoint=$(setting BACKUP_S3_ENDPOINT)
    if [ -n "$endpoint" ]; then
        cat > "$1" <<EOF
RCLONE_CONFIG_STORE_TYPE=s3
RCLONE_CONFIG_STORE_PROVIDER=Other
RCLONE_CONFIG_STORE_ACCESS_KEY_ID=$BACKUP_KEY_ID
RCLONE_CONFIG_STORE_SECRET_ACCESS_KEY=$BACKUP_KEY
RCLONE_CONFIG_STORE_ENDPOINT=$endpoint
RCLONE_CONFIG_STORE_NO_CHECK_BUCKET=true
EOF
    else
        # hard_delete: a pruned backup is gone, rather than kept as a hidden old version that still costs
        cat > "$1" <<EOF
RCLONE_CONFIG_STORE_TYPE=b2
RCLONE_CONFIG_STORE_ACCOUNT=$BACKUP_KEY_ID
RCLONE_CONFIG_STORE_KEY=$BACKUP_KEY
RCLONE_CONFIG_STORE_HARD_DELETE=true
EOF
    fi
    chmod 600 "$1"
}
