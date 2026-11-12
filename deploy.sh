#!/usr/bin/env bash
# S-Lab HRMS deploy script. Run on the server from the repository folder:
#
#   ./deploy.sh            # first time: creates .env.production, then deploys
#   ./deploy.sh            # later: pulls latest code, backs up DB, rebuilds, migrates, restarts
#   ./deploy.sh --no-pull  # deploy the code that is already checked out
#   ./deploy.sh status     # show containers, health and recent logs
#   ./deploy.sh logs       # follow app logs
#   ./deploy.sh backup     # database backup only
#   ./deploy.sh rollback   # go back to the previous app image
#   ./deploy.sh seed       # create the owner account from OWNER_* in .env.production
#   ./deploy.sh install-autodeploy    # deploy automatically when main changes on GitHub (CI must pass)
#   ./deploy.sh uninstall-autodeploy
#
# Safe to run repeatedly. Stops on the first error. If the new version fails its health check,
# the previous version is started again automatically.
set -Eeuo pipefail

cd "$(dirname "$0")"
ENV_FILE=".env.production"
BRANCH="${DEPLOY_BRANCH:-main}"
PORT_DEFAULT=3000
COMPOSE=(docker compose --env-file "$ENV_FILE" -p s-lab-hrms)

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
trap 'die "deploy failed at line $LINENO (see output above)"' ERR

need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed. $2"; }

envval() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }

compose_profiles() {
  local p=()
  [ -n "$(envval CLOUDFLARE_TUNNEL_TOKEN)" ] && p+=(--profile tunnel)
  echo "${p[@]:-}"
}

create_env() {
  log "Creating $ENV_FILE (first run)"
  need openssl "Install it with: sudo apt-get install -y openssl"
  cat > "$ENV_FILE" <<EOF
# S-Lab HRMS production settings. Keep this file private (it is not in git).
APP_URL=https://hrms.s-lab.dev
APP_PORT=$PORT_DEFAULT
AUTH_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
# External database (leave empty to use the bundled one): postgresql://user:password@host:5432/hrms
HRMS_DATABASE_URL=
SECURE_COOKIES=true

# First owner (OP) account, created by: ./deploy.sh seed
OWNER_PHONE=
OWNER_NAME=Owner
BUSINESS_NAME=GGU
SITE_NAME=Main

# Cloudflare tunnel token (Zero Trust > Networks > Tunnels > your tunnel > token).
# Leave empty if cloudflared already runs on this server; then point it to http://localhost:$PORT_DEFAULT
CLOUDFLARE_TUNNEL_TOKEN=

# Login OTP. For testing keep console + OTP_SHOW_IN_UI=true.
# For real use: SMS_PROVIDER=fast2sms, fill the FAST2SMS_* values, and OTP_SHOW_IN_UI=false.
SMS_PROVIDER=console
OTP_SHOW_IN_UI=true
FAST2SMS_API_KEY=
FAST2SMS_MODE=otp
FAST2SMS_OTP_ID=
FAST2SMS_SENDER_ID=
FAST2SMS_DLT_MESSAGE_ID=

# Face recognition: mock (test mode) or aws. See AWS_SETUP.md.
FACE_PROVIDER=mock
FACE_MATCH_THRESHOLD=95
FACE_LIVENESS=false
FACE_LIVENESS_THRESHOLD=80
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_LIVENESS_ROLE_ARN=

GITHUB_REPO=Sidharth-max/s-lab-hrms
GITHUB_TOKEN=
EOF
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE. Fill OWNER_PHONE (and CLOUDFLARE_TUNNEL_TOKEN if used), then run ./deploy.sh again."
}

health() {
  local port; port="$(envval APP_PORT)"; port="${port:-$PORT_DEFAULT}"
  for _ in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then return 0; fi
    sleep 3
  done
  return 1
}

backup() {
  mkdir -p backups
  local f="backups/hrms-$(date +%Y%m%d-%H%M%S).sql.gz"
  local remote; remote="$(envval HRMS_DATABASE_URL)"
  if [ -n "$remote" ]; then
    # External database (HRMS_DATABASE_URL): dump it with a throwaway Postgres client container.
    log "Backing up external database to $f"
    docker run --rm --network host -e PGURL="$remote" public.ecr.aws/docker/library/postgres:16-alpine \
      sh -c 'pg_dump "$PGURL" --no-owner' | gzip > "$f.part"
  elif "${COMPOSE[@]}" ps --status running db 2>/dev/null | grep -q db; then
    log "Backing up database to $f"
    "${COMPOSE[@]}" exec -T db pg_dump -U hrms -d hrms --no-owner | gzip > "$f.part"
  else
    echo "Database not running yet, no backup needed."
    return 0
  fi
  mv "$f.part" "$f"
  # Keep the newest 30 backups.
  ls -1t backups/hrms-*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm -f
}

seed() {
  [ -n "$(envval OWNER_PHONE)" ] || die "Set OWNER_PHONE in $ENV_FILE first"
  log "Creating owner account (skipped if it already exists)"
  "${COMPOSE[@]}" --profile tools run --rm migrate npx tsx prisma/seed.ts
}

rollback() {
  docker image inspect s-lab-hrms:previous >/dev/null 2>&1 || die "No previous image to roll back to"
  log "Rolling back to previous image"
  docker tag s-lab-hrms:previous s-lab-hrms:current
  # shellcheck disable=SC2046
  "${COMPOSE[@]}" $(compose_profiles) up -d --no-build app
  health && echo "Rolled back and healthy." || die "Previous version is not healthy either. Check: ./deploy.sh logs"
}

status() {
  "${COMPOSE[@]}" --profile tunnel ps
  health && echo "Health: OK" || echo "Health: FAILING"
  "${COMPOSE[@]}" logs --tail 40 app
}

deploy() {
  local pull=1
  [ "${1:-}" = "--no-pull" ] && pull=0
  need docker "Install Docker: https://docs.docker.com/engine/install/"
  docker compose version >/dev/null 2>&1 || die "Docker Compose plugin missing (docker compose)."
  need curl "Install it with: sudo apt-get install -y curl"
  [ -f "$ENV_FILE" ] || { create_env; exit 0; }
  [ -n "$(envval AUTH_SECRET)" ] || die "AUTH_SECRET is empty in $ENV_FILE"
  [ -n "$(envval POSTGRES_PASSWORD)" ] || die "POSTGRES_PASSWORD is empty in $ENV_FILE"

  if [ "$pull" = 1 ] && [ -d .git ]; then
    log "Pulling latest code ($BRANCH)"
    git fetch origin "$BRANCH"
    git checkout "$BRANCH"
    git merge --ff-only "origin/$BRANCH" || die "This server has local commits that are not on GitHub, so it cannot update.
Put those changes on GitHub first, then run: git reset --hard origin/$BRANCH"
  fi
  local version; version="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"

  log "Starting database"
  "${COMPOSE[@]}" up -d --wait db
  backup

  if docker image inspect s-lab-hrms:current >/dev/null 2>&1; then
    docker tag s-lab-hrms:current s-lab-hrms:previous
  fi

  log "Building version $version"
  APP_VERSION="$version" "${COMPOSE[@]}" --profile tools build migrate app

  log "Applying database migrations"
  "${COMPOSE[@]}" --profile tools run --rm migrate

  log "Starting app"
  # shellcheck disable=SC2046
  APP_VERSION="$version" "${COMPOSE[@]}" $(compose_profiles) up -d --no-build app $( [ -n "$(envval CLOUDFLARE_TUNNEL_TOKEN)" ] && echo tunnel )

  log "Checking health"
  if health; then
    echo "Deployed $version. Local: http://127.0.0.1:$(envval APP_PORT)  Public: $(envval APP_URL)"
  else
    "${COMPOSE[@]}" logs --tail 80 app || true
    if docker image inspect s-lab-hrms:previous >/dev/null 2>&1; then
      trap - ERR
      echo "New version is not healthy. Rolling back."
      rollback
      exit 1
    fi
    die "App is not healthy and there is no previous version to roll back to."
  fi

  if [ -n "$(envval OWNER_PHONE)" ]; then seed; fi
  docker image prune -f >/dev/null 2>&1 || true
}

install_autodeploy() {
  local dir; dir="$(pwd)"
  chmod +x scripts/auto-deploy.sh
  if command -v systemctl >/dev/null 2>&1 && [ -d /etc/systemd/system ]; then
    log "Installing auto-deploy timer (checks GitHub every minute)"
    sudo tee /etc/systemd/system/s-lab-hrms-autodeploy.service >/dev/null <<EOF
[Unit]
Description=S-Lab HRMS auto-deploy from GitHub main
After=network-online.target docker.service

[Service]
Type=oneshot
User=$(id -un)
WorkingDirectory=$dir
ExecStart=$dir/scripts/auto-deploy.sh
EOF
    sudo tee /etc/systemd/system/s-lab-hrms-autodeploy.timer >/dev/null <<EOF
[Unit]
Description=Run S-Lab HRMS auto-deploy every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min

[Install]
WantedBy=timers.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable --now s-lab-hrms-autodeploy.timer
    echo "Auto-deploy on. Log: $dir/.autodeploy/auto-deploy.log"
  else
    log "Installing auto-deploy cron job (every minute)"
    ( crontab -l 2>/dev/null | grep -v s-lab-hrms-autodeploy; echo "* * * * * $dir/scripts/auto-deploy.sh # s-lab-hrms-autodeploy" ) | crontab -
    echo "Auto-deploy on. Log: $dir/.autodeploy/auto-deploy.log"
  fi
}

uninstall_autodeploy() {
  if command -v systemctl >/dev/null 2>&1 && [ -f /etc/systemd/system/s-lab-hrms-autodeploy.timer ]; then
    sudo systemctl disable --now s-lab-hrms-autodeploy.timer
    sudo rm -f /etc/systemd/system/s-lab-hrms-autodeploy.{service,timer}
    sudo systemctl daemon-reload
  fi
  ( crontab -l 2>/dev/null | grep -v s-lab-hrms-autodeploy ) | crontab - 2>/dev/null || true
  echo "Auto-deploy off."
}

case "${1:-}" in
  install-autodeploy) install_autodeploy ;;
  uninstall-autodeploy) uninstall_autodeploy ;;
  status) status ;;
  logs) "${COMPOSE[@]}" logs -f --tail 100 app ;;
  backup) backup ;;
  rollback) rollback ;;
  seed) seed ;;
  ""|--no-pull) deploy "${1:-}" ;;
  *) die "Unknown command: $1" ;;
esac
