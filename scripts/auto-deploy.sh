#!/usr/bin/env bash
# Auto-deploy: run every minute on the server (installed by ./deploy.sh install-autodeploy).
# When main on GitHub has a new commit AND its CI checks passed, it runs ./deploy.sh.
# Commits whose CI failed are skipped (the site keeps running the last good version).
set -Eeuo pipefail

cd "$(dirname "$0")/.."
BRANCH="${DEPLOY_BRANCH:-main}"
REPO="$(grep -E '^GITHUB_REPO=' .env.production 2>/dev/null | cut -d= -f2- || true)"
REPO="${REPO:-Sidharth-max/s-lab-hrms}"
TOKEN="$(grep -E '^GITHUB_TOKEN=' .env.production 2>/dev/null | cut -d= -f2- || true)"
STATE_DIR=".autodeploy"
mkdir -p "$STATE_DIR"
LOG="$STATE_DIR/auto-deploy.log"

exec 9>"$STATE_DIR/lock"
flock -n 9 || exit 0 # a deploy is already running

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

git fetch -q origin "$BRANCH" || { log "git fetch failed"; exit 0; }
REMOTE="$(git rev-parse "origin/$BRANCH")"
# Deploy when the RUNNING app is older than main — not when the checkout is.
# The server often commits and pushes from this same checkout, which makes
# REMOTE == LOCAL while the running container still serves an older version.
# The health endpoint reports the deployed version (deploy.sh builds with it).
PORT="$(grep -E '^APP_PORT=' .env.production 2>/dev/null | tail -1 | cut -d= -f2-)"
RUNNING="$(curl -fsS --max-time 10 "http://127.0.0.1:${PORT:-3000}/api/health" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("version",""))' 2>/dev/null || true)"
[ -n "$RUNNING" ] && [ "$(git rev-parse --short "$REMOTE" 2>/dev/null)" = "$RUNNING" ] && exit 0
[ "$(cat "$STATE_DIR/failed-sha" 2>/dev/null || true)" = "$REMOTE" ] && exit 0

# Wait for the CI workflow ("web" job) on that commit.
AUTH=()
[ -n "$TOKEN" ] && AUTH=(-H "Authorization: Bearer $TOKEN")
RUNS="$(curl -fsS "${AUTH[@]}" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/commits/$REMOTE/check-runs?check_name=web" 2>/dev/null || true)"
if [ -z "$RUNS" ]; then log "could not read CI status for ${REMOTE:0:7}"; exit 0; fi
STATUS="$(printf '%s' "$RUNS" | python3 -c 'import json,sys; r=(json.load(sys.stdin).get("check_runs") or [None])[0]; print("%s:%s" % (r["status"], r["conclusion"]) if r else "none")')"

case "$STATUS" in
  completed:success)
    log "deploying ${REMOTE:0:7}"
    if ./deploy.sh >> "$LOG" 2>&1; then
      log "deployed ${REMOTE:0:7}"
    else
      # A failed build is often Docker's build cache, not the code (e.g. "parent snapshot ... does
      # not exist"). Clear the build cache and try once more before giving up on this version.
      log "deploy of ${REMOTE:0:7} failed; clearing the Docker build cache and retrying once"
      docker builder prune -af >> "$LOG" 2>&1 || true
      if ./deploy.sh >> "$LOG" 2>&1; then
        log "deployed ${REMOTE:0:7} (on retry)"
      else
        echo "$REMOTE" > "$STATE_DIR/failed-sha"
        log "DEPLOY FAILED for ${REMOTE:0:7} after a retry (site kept on previous version). See above. Fix, or run ./deploy.sh and delete $STATE_DIR/failed-sha."
      fi
    fi
    ;;
  completed:*)
    echo "$REMOTE" > "$STATE_DIR/failed-sha"
    log "CI failed for ${REMOTE:0:7} ($STATUS), not deploying"
    ;;
  *) : ;; # CI still running or not started yet; check again next minute
esac
