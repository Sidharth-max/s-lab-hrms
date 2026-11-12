# S-Lab HRMS

Attendance and salary for GGU staff: face-scan attendance on a tablet, advances, monthly salary with
optional PF and ESIC, payslips. Web app for owner and managers, Android app (same features plus the
face scanner), and a view-only web login for employees.

- Production: https://hrms.s-lab.dev
- Server deployment and auto-deploy: [DEPLOYMENT.md](DEPLOYMENT.md)
- Face recognition setup: [AWS_SETUP.md](AWS_SETUP.md)

## How it works

| Who | Where | Can do |
|---|---|---|
| Owner (OP) | Web, Android app | Everything; approves negative advances (in app, or OTP to their mobile); reopens locked months |
| Manager | Web, Android app | What the owner allows (per-manager permissions and sites) |
| Employee | Web only | View own salary structure, attendance, advances, payslips |
| Worker at the gate | Registered tablet / phone | Look at the camera: first scan IN, next scan OUT, voice confirmation |

A device becomes a scanner after a one-time owner/manager login (Devices > Make this device a scanner).
If the tablet or internet is down, a permitted manager adds the missed punch or day status later; every edit
keeps history.

Salary: monthly staff are paid for weekly offs and holidays, daily-wage staff for days worked. PF and ESIC
are per-employee switches (default off). Advances are recovered in full at month end or over chosen months;
anything not recovered rolls to the next month. No professional tax.

## Local development

```bash
cp .env.example .env          # set DATABASE_URL to a local Postgres and a random AUTH_SECRET
npm install
npx prisma migrate dev
OWNER_PHONE=9876543210 npm run db:seed
npm run dev                   # http://localhost:3000 (OTP is shown on screen in test mode)
```

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
Browser smoke test (server running in test mode, fresh seeded DB):
`NODE_PATH=$(npm root -g) node e2e/smoke.mjs`

## Android app

`android/` is a Capacitor shell that opens the website. GitHub Actions builds the APK on every push to
`main` that changes the shell and publishes it as a GitHub Release; `/download` on the site always serves
the newest one, and installed apps show an update pop-up.
