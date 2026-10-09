#!/usr/bin/env bash
# Continuous deployment: publish the newest commit of main once its CI has passed.
#
# Run every minute by deploy/systemd/fifa-auto-deploy.timer, always from a clean clone ($REPO), never
# from someone's working copy. For a new commit of main it:
#   1. waits for the GitHub Actions checks (backend, frontend) on that commit; a failure skips it,
#   2. checks it out and runs deploy/deploy.sh (database backup first, then build, restart, smoke test),
#   3. if that fails, puts the previously live commit back the same way.
# Only reads from GitHub (the repository is public): no credentials are stored for it.
#
# Usage: deploy/auto-deploy.sh            one pass (what the timer runs)
#        deploy/auto-deploy.sh --status   what is live and what happened last
set -euo pipefail

# Everything lives in functions and the last line calls main: the checkout below replaces this very
# file, and bash must have read all of it before that happens.

BASE=${FIFA_BASE:-/root/programs/fifa-app}
REPO=${FIFA_REPO:-$BASE/repo}
GITHUB_REPO=${GITHUB_REPO:-SeyyidOS/FifaDatabaseApp}
BRANCH=${DEPLOY_BRANCH:-main}
CHECKS=(backend frontend)
LIVE="$BASE/deploy-live"            # commit that is live
SKIPPED="$BASE/deploy-skipped"      # commits whose CI or deploy failed; never retried
WAITING="$BASE/deploy-waiting"      # commit waiting for CI (logged once)
LOG="$BASE/auto-deploy.log"
CI_TIMEOUT=$((45 * 60))             # give up on a commit whose checks never show up

log() { echo "$(date '+%F %T') $*" | tee -a "$LOG"; }

# success | pending | failure for the required checks of a commit
ci_state() {
    local sha=$1 age=$2
    curl -fsS --max-time 20 -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$GITHUB_REPO/commits/$sha/check-runs?per_page=100" |
        python3 -I -c '
import json, sys
required, age, timeout = sys.argv[1].split(","), int(sys.argv[2]), int(sys.argv[3])
runs = {r["name"]: r for r in json.load(sys.stdin)["check_runs"]}
if any(r["status"] == "completed" and r["conclusion"] not in ("success", "skipped") for r in runs.values()):
    print("failure")
elif all(n in runs and runs[n]["status"] == "completed" for n in required):
    print("success")
else:
    print("failure" if age > timeout else "pending")
' "$(IFS=,; echo "${CHECKS[*]}")" "$age" "$CI_TIMEOUT"
}

publish() {  # $1 = commit; runs deploy.sh from that commit
    git -C "$REPO" checkout --quiet --force --detach "$1"
    APP_VERSION=$(git -C "$REPO" rev-parse --short "$1") "$REPO/deploy/deploy.sh" >>"$LOG" 2>&1
}

status() {
    echo "live:    $(cat "$LIVE" 2>/dev/null || echo none)"
    echo "waiting: $(cat "$WAITING" 2>/dev/null || echo none)"
    echo "skipped: $(tail -n 3 "$SKIPPED" 2>/dev/null | tr '\n' ' ')"
    echo "--- last log lines ($LOG)"
    tail -n 15 "$LOG" 2>/dev/null || true
}

main() {
    if [ "${1:-}" = --status ]; then
        status
        return
    fi
    mkdir -p "$BASE"
    exec 9>"$BASE/auto-deploy.lock"
    flock -n 9 || return 0  # a deploy is still running

    git -C "$REPO" fetch --quiet origin "$BRANCH"
    local target current subject age
    target=$(git -C "$REPO" rev-parse "origin/$BRANCH")
    current=$(cat "$LIVE" 2>/dev/null || echo none)
    [ "$target" = "$current" ] && return 0
    grep -qx "$target" "$SKIPPED" 2>/dev/null && return 0

    subject=$(git -C "$REPO" log -1 --format=%s "$target")
    age=$(($(date +%s) - $(git -C "$REPO" log -1 --format=%ct "$target")))
    case "$(ci_state "$target" "$age" || echo pending)" in
        pending)
            if [ "$(cat "$WAITING" 2>/dev/null)" != "$target" ]; then
                echo "$target" >"$WAITING"
                log "waiting for CI on ${target:0:7} ($subject)"
            fi
            return 0
            ;;
        failure)
            echo "$target" >>"$SKIPPED"
            log "CI failed on ${target:0:7} ($subject): not deploying it"
            return 0
            ;;
    esac

    log "deploying ${target:0:7} ($subject)"
    if publish "$target"; then
        echo "$target" >"$LIVE"
        log "live: ${target:0:7}"
        return 0
    fi
    echo "$target" >>"$SKIPPED"
    log "deploy of ${target:0:7} failed (details above in $LOG)"
    if [ "$current" != none ]; then
        log "putting ${current:0:7} back"
        if publish "$current"; then
            log "live again: ${current:0:7}"
        else
            log "ROLLBACK FAILED: the site may be down; see $LOG and deploy/README.md"
        fi
    fi
    return 1
}

main "$@"; exit $?
