# Deployment guide

Written for the person or AI agent operating the server. Production URL: **https://hrms.s-lab.dev**
(served through a Cloudflare tunnel; the app itself only listens on `127.0.0.1:3000`).

## What runs where

| Part | Where | How it updates |
|---|---|---|
| Website + API (Next.js) | Server, Docker container `app` | Push to `main` → auto-deploy (CI must pass) |
| Database (Postgres 16) | Server, Docker container `db`, volume `s-lab-hrms_pgdata` | Migrations run on every deploy |
| Public access | Cloudflare tunnel (`tunnel` container, or cloudflared already on the host) | n/a |
| Android app (APK) | GitHub Releases, built by `.github/workflows/android.yml` | Push to `main` that touches `android/`, `android-web/`, `capacitor.config.ts` or `package*.json` |

The Android app is a shell that opens https://hrms.s-lab.dev, so website changes reach the app instantly.
A new APK is only needed when the Android shell itself changes.

## First-time server setup

Requirements: Linux server, Docker Engine with the compose plugin, git, curl, python3, outbound internet.

```bash
git clone https://github.com/Sidharth-max/s-lab-hrms.git
cd s-lab-hrms
./deploy.sh                 # creates .env.production and stops
nano .env.production        # set OWNER_PHONE, and CLOUDFLARE_TUNNEL_TOKEN if the tunnel runs in Docker
./deploy.sh                 # builds, migrates, starts, health-checks, creates the owner account
./deploy.sh install-autodeploy   # deploy automatically whenever main changes
```

### Cloudflare tunnel

Option A, tunnel in Docker (recommended):
1. Cloudflare dashboard > Zero Trust > Networks > Tunnels > Create a tunnel (type cloudflared).
2. Copy the token into `CLOUDFLARE_TUNNEL_TOKEN` in `.env.production`.
3. Public hostname: `hrms.s-lab.dev` → service `http://app:3000`.
4. `./deploy.sh --no-pull`

Option B, cloudflared already installed on the host: leave the token empty and point the public
hostname `hrms.s-lab.dev` to `http://localhost:3000`.

## Day-to-day commands (run in the repository folder)

| Command | What it does |
|---|---|
| `./deploy.sh` | Pull `main`, back up DB, build, migrate, restart, health check, auto-rollback on failure |
| `./deploy.sh --no-pull` | Same, without pulling (use after editing `.env.production`) |
| `./deploy.sh status` | Containers, health, last 40 log lines |
| `./deploy.sh logs` | Follow app logs |
| `./deploy.sh backup` | Database backup to `backups/` (newest 30 kept) |
| `./deploy.sh rollback` | Start the previous app image again |
| `./deploy.sh seed` | Create the owner account from `OWNER_*` settings (skips if it exists) |
| `./deploy.sh install-autodeploy` / `uninstall-autodeploy` | Turn auto-deploy on or off |

Auto-deploy log: `.autodeploy/auto-deploy.log`. A commit whose CI failed, or whose deploy failed its health
check, is skipped and recorded in `.autodeploy/failed-sha`; the site stays on the last good version.
Delete that file to retry the same commit.

## Checks after any deploy

```bash
curl -fsS http://127.0.0.1:3000/api/health          # {"ok":true,"version":"<git sha>"}
curl -fsS https://hrms.s-lab.dev/api/health         # same, through the tunnel
curl -sI https://hrms.s-lab.dev/download | grep -i location   # GitHub release APK link
```

## Restore a backup

```bash
./deploy.sh backup     # safety copy of the current state first
gunzip -c backups/hrms-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose --env-file .env.production -p s-lab-hrms exec -T db psql -U hrms -d hrms -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" -f -
./deploy.sh --no-pull
```

Copy `backups/` off the server regularly (for example a nightly `rsync` or cloud storage). Add a cron entry for
nightly backups: `30 2 * * * cd /path/to/s-lab-hrms && ./deploy.sh backup >/dev/null 2>&1`

## Settings (`.env.production`)

| Variable | Meaning |
|---|---|
| `APP_URL` | Public URL, `https://hrms.s-lab.dev` |
| `AUTH_SECRET`, `POSTGRES_PASSWORD` | Generated on first run. Never change `POSTGRES_PASSWORD` after the DB exists. |
| `SMS_PROVIDER` | `console` (OTP only in logs) or `fast2sms` |
| `FAST2SMS_API_KEY` | Fast2SMS Dev API key (secret) |
| `FAST2SMS_MODE` | `otp` (uses `FAST2SMS_OTP_ID`, the OTP template ID) or `dlt` (uses `FAST2SMS_SENDER_ID` and `FAST2SMS_DLT_MESSAGE_ID`; the template's `{#var#}` is the OTP) |
| `OTP_SHOW_IN_UI` | `true` shows the OTP on screen. **Testing only; set `false` before real use.** |
| `FACE_PROVIDER` | `mock` (test mode) or `aws`. See `AWS_SETUP.md`. |
| `FACE_LIVENESS`, `AWS_LIVENESS_ROLE_ARN` | Anti-spoof liveness check (optional) |
| `CLOUDFLARE_TUNNEL_TOKEN` | Starts the tunnel container when set |
| `SECURE_COOKIES` | Keep `true` behind https. Only `false` for plain-http testing. |

## Android APK publishing (GitHub)

- Every push to `main` touching the Android shell builds an APK and publishes Release `apk-v<N>`.
  `https://hrms.s-lab.dev/download` redirects to the newest release; installed apps show an update pop-up.
- Other branches: APK is attached to the workflow run as an artifact (Actions tab), no release.
- **Signing key (do once):** run `scripts/make-android-key.sh` on a trusted computer and add the four secrets
  it prints under GitHub > Settings > Secrets and variables > Actions. Without them the workflow builds a
  debug-signed test APK, and each new test APK must be installed after uninstalling the previous one.
  Never lose the key: apps signed with a different key cannot be updated in place.
- Optional repository variable `APP_URL` (Settings > Variables) changes which site the app opens.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Deploy says not healthy, rolled back | `./deploy.sh logs`; usually a bad `.env.production` value or a failed migration |
| Site 502 via Cloudflare, local health OK | Tunnel: `docker compose --env-file .env.production -p s-lab-hrms logs tunnel`, check hostname → `http://app:3000` |
| Login OTP never arrives | With `SMS_PROVIDER=console` it is only in the logs: `./deploy.sh logs \| grep OTP`. With Fast2SMS: `./deploy.sh logs \| grep Fast2SMS` shows the reason (balance, template ID, number). |
| Scanner says "not registered" | An owner/manager logs in on the tablet once: Devices > Make this device a scanner |
| Camera does not open | Must be https (the tunnel) and camera permission allowed in the app / browser |
| `429 Too Many Requests` pulling images | Base images come from `public.ecr.aws` mirrors; retry later |
