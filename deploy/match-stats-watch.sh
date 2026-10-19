#!/usr/bin/env bash
# Reads match-stat photos soon after they are uploaded, so a night's stats (and its Night Post) are ready
# minutes after its last match instead of the next morning.
#
# root's crontab runs it every 10 minutes. Most runs only ask the database whether new photos wait (cheap).
# When some do, Claude Code on this server reads them with deploy/match-stats-prompt.md (the server
# owner's subscription, no API key) and saves through deploy/match-stats.py. Each photo is tried once,
# saved or skipped (match-stats.py tried), so an unreadable one doesn't cost a read every 10 minutes.
#
#   */10 * * * * /root/programs/fifa-app/repo/deploy/match-stats-watch.sh
set -euo pipefail
export PATH="/root/.local/bin:/usr/local/bin:/usr/bin:/bin"
HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/match-stats.py"
BASE=${FIFA_BASE:-/root/programs/fifa-app}
LOG=${STATS_OCR_LOG:-$BASE/stats-ocr.log}
OUT=${STATS_OCR_DIR:-/tmp/fifa-match-stats}

# one read at a time; a slow one isn't started twice
exec 9>"/tmp/fifa-match-stats.lock"
flock -n 9 || exit 0

ids=$(python3 "$SCRIPT" count --new --ids)
[ -n "$ids" ] || exit 0

{
    echo "== $(date '+%F %T') photos $ids"
    # in a folder that isn't a project, so no project's instructions or hooks come along
    cd "$BASE"
    claude -p "$(sed "s#{script}#$SCRIPT#g" "$HERE/match-stats-prompt.md")" \
        --allowedTools "Read" "Write" "Bash(python3 $SCRIPT pending:*)" "Bash(python3 $SCRIPT submit:*)" \
        --max-turns 60 || echo "the read failed (exit $?)"
    # tried, whatever came of it: a skipped photo waits for a person (or a better photo)
    python3 "$SCRIPT" tried $ids
    rm -rf "$OUT"
} >>"$LOG" 2>&1
