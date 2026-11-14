// Screenshots of every page, one PNG per page, for the Android app (browser build) and the website.
//
// Devices
//   app:     fold-closed (Galaxy Z Fold cover, 344x882), fold-open (690x829), fold-open-landscape
//            (829x690), phone (412x915)
//   website: mobile (412x915, full page), desktop (1440x900, full page)
// Each in light and dark. Pixel density is SCALE (default 4 = 4x).
//
// Needs a server in TEST MODE (OTP shown on screen, mock face): SMS_PROVIDER=console OTP_SHOW_IN_UI=true
// FACE_PROVIDER=mock, and the app's browser build pointed at it:
//   npx next dev -p 3000
//   cd mobile && APP_URL=http://localhost:3000 npx expo start --web --port 8081
// Then:
//   node scripts/screenshots.mjs
// Options (environment variables):
//   WEB_URL=http://localhost:3000  APP_URL=http://localhost:8081  OWNER_PHONE=9876543210
//   EMPLOYEE_PHONE=...  (an employee with web login, for the website's /me page; skipped if not set)
//   OUT=screenshots  SCALE=4  ONLY=app|web  DEVICES=phone,desktop  THEMES=light,dark  PARALLEL=3
// Output: OUT/app/<device>/<theme>/NN-page.png and OUT/website/<device>/<theme>/NN-page.png
//
// Uses the preinstalled Playwright (set NODE_PATH to the global node_modules) or a local install.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";

const { chromium } = createRequire(import.meta.url)("playwright");

const WEB = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const APP = (process.env.APP_URL ?? "http://localhost:8081").replace(/\/$/, "");
const OWNER = process.env.OWNER_PHONE ?? "9876543210";
const EMPLOYEE = process.env.EMPLOYEE_PHONE;
const OUT = process.env.OUT ?? "screenshots";
const SCALE = Number(process.env.SCALE ?? 4);
const PARALLEL = Number(process.env.PARALLEL ?? 3);
const pick = (v, all) => (v ? v.split(",").map((s) => s.trim()).filter((s) => all.includes(s)) : all);

const APP_DEVICES = { "fold-closed": [344, 882], "fold-open": [690, 829], "fold-open-landscape": [829, 690], phone: [412, 915] };
const WEB_DEVICES = { mobile: [412, 915], desktop: [1440, 900] };
const THEMES = pick(process.env.THEMES, ["light", "dark"]);

// ---------- test data, looked up from the server ----------

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(WEB + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${data.error ?? ""}`);
  return data;
}

async function appToken(phone) {
  const { devCode } = await api("/api/m/auth/request", { method: "POST", body: { phone } });
  if (!devCode) throw new Error("The server did not return the OTP: run it in test mode (OTP_SHOW_IN_UI=true, SMS_PROVIDER=console).");
  return (await api("/api/m/auth/verify", { method: "POST", body: { phone, code: devCode } })).token;
}

const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() + 5.5 * 3600000 - n * 86400000).toISOString().slice(0, 10);

async function testData(token) {
  const [{ employees }, { advances }, me] = await Promise.all([
    api("/api/m/employees", { token }),
    api("/api/m/advances", { token }),
    api("/api/m/me", { token }),
  ]);
  const active = employees.filter((e) => e.active);
  if (!active.length) throw new Error("No active employees: add some data first.");
  const withFace = active.find((e) => e.face) ?? active[0];
  const noFace = active.find((e) => !e.face) ?? active[0];
  const advance = advances.find((a) => a.status === "ACTIVE") ?? advances[0];
  // Scanner token: registering with a fixed hardware id reuses one entry on every run.
  const siteId = me.sites?.[0]?.id;
  const device = siteId ? await api("/api/m/devices/register", { method: "POST", token, body: { siteId, name: "Screenshot scanner", hardwareId: "screenshot-script", model: "Script" } }) : null;
  return { emp: withFace, other: active[1] ?? withFace, noFace, advance, deviceToken: device?.deviceToken, dayDate: daysAgo(new Date().getUTCDay() === 1 ? 2 : 1) };
}

// ---------- page lists ----------

const appPages = (d) => [
  ["01-login", "/login", { noAuth: true }],
  ["02-today", "/"],
  ["03-employees", "/employees"],
  ["04-attendance", "/attendance"],
  ["05-salary", "/salary"],
  ["06-more-menu", "/", { click: /^More/ }],
  ["07-search", "/", { click: /^Search$/ }],
  ["08-employee-detail", `/employee/${d.emp.id}`],
  ["09-employee-attendance", `/employee/${d.emp.id}`, { tab: "Attendance" }],
  ["10-employee-ledger", `/employee/${d.emp.id}`, { tab: "Ledger" }],
  ["11-employee-edit", `/employee/edit/${d.emp.id}`],
  ["12-employee-new", "/employee/new"],
  ["13-attendance-day", `/attendance/${d.other.id}/${d.dayDate}`],
  ["14-advances", "/advances"],
  ...(d.advance ? [["15-advance-detail", `/advance/${d.advance.id}`]] : []),
  ["16-approvals", "/approvals"],
  ["17-leaves", "/leaves"],
  ["18-register", "/register"],
  ["19-history", "/history"],
  ["20-team", "/team"],
  ["21-devices", "/devices"],
  ["22-settings", "/settings"],
  ["23-scanner-setup", "/scanner-setup"],
  ["24-face-enroll", `/face-enroll?id=${d.noFace.id}&name=${encodeURIComponent(d.noFace.name)}`],
  ...(d.deviceToken ? [["25-scanner", "/scanner", { scanner: true }]] : []),
];

const webPages = (d) => [
  ["01-login", "/login", { noAuth: true }],
  ["02-dashboard", "/dashboard"],
  ["03-employees", "/employees"],
  ["04-employee-detail", `/employees/${d.emp.id}`],
  ["05-employee-ledger", `/employees/${d.emp.id}?tab=ledger`],
  ["06-employee-edit", `/employees/${d.emp.id}/edit`],
  ["07-employee-new", "/employees/new"],
  ["08-attendance", "/attendance"],
  ["09-attendance-day", `/attendance/${d.other.id}/${d.dayDate}`],
  ["10-attendance-register", "/attendance/register"],
  ["11-salary", "/salary"],
  ["12-payroll", "/payroll"],
  ["13-advances", "/advances"],
  ["14-approvals", "/approvals"],
  ["15-leaves", "/leaves"],
  ["16-team", "/team"],
  ["17-devices", "/devices"],
  ["18-settings", "/settings"],
  ["19-audit", "/audit"],
  ["20-scan", "/scan"],
  ...(EMPLOYEE ? [["21-employee-portal", "/me", { employee: true }]] : []),
];

// ---------- capture ----------

const errors = [];
let done = 0;

async function settle(page, extra = 0) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(2500 + extra);
  // Wait for skeletons / spinners to go (best effort).
  await page.waitForFunction(() => !document.querySelector('[aria-label="Loading"], [role="progressbar"]'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function appRun(browser, d, device, theme, tokens) {
  const [w, h] = APP_DEVICES[device];
  const dir = `${OUT}/app/${device}/${theme}`;
  mkdirSync(dir, { recursive: true });
  for (const [name, path, o = {}] of appPages(d)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: SCALE, colorScheme: theme, isMobile: true, hasTouch: true, permissions: ["camera"] });
    await ctx.addInitScript(([t, th, dev, opt]) => {
      localStorage.setItem("hrms.theme", th);
      if (!opt.noAuth && !opt.scanner) localStorage.setItem("hrms.session", t);
      if (opt.scanner && dev) localStorage.setItem("hrms.device", dev);
    }, [tokens.owner, theme, d.deviceToken, o]);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`app ${device} ${theme} ${name}: ${e.message}`));
    try {
      await page.goto(APP + path, { timeout: 120000 });
      await settle(page, 2000);
      if (o.click) {
        await page.getByRole("button", { name: o.click }).first().click();
        await page.waitForTimeout(1500);
      }
      if (o.tab) {
        await page.getByRole("tab", { name: o.tab }).last().click();
        await settle(page);
      }
      await page.screenshot({ path: `${dir}/${name}.png` });
    } catch (e) {
      errors.push(`app ${device} ${theme} ${name}: ${String(e.message).split("\n")[0]}`);
    }
    await ctx.close().catch(() => {});
    done++;
  }
  console.log(`done app ${device} ${theme}`);
}

async function webLogin(browser, phone) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${WEB}/login`);
  await page.fill("#phone", phone);
  await page.click("text=Get OTP");
  const code = (await page.locator("b.tracking-widest").textContent()).trim();
  await page.fill("#code", code);
  await page.waitForTimeout(1500); // the form submits by itself once 6 digits are in
  if (page.url().includes("/login")) await page.click("button:has-text('Log in')", { timeout: 5000 }).catch(() => {});
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function webRun(browser, d, device, theme, states) {
  const [w, h] = WEB_DEVICES[device];
  const dir = `${OUT}/website/${device}/${theme}`;
  mkdirSync(dir, { recursive: true });
  for (const [name, path, o = {}] of webPages(d)) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: SCALE,
      colorScheme: theme,
      permissions: ["camera"],
      storageState: o.noAuth ? undefined : o.employee ? states.employee : states.owner,
      ...(device === "mobile" ? { isMobile: true, hasTouch: true } : {}),
    });
    await ctx.addInitScript((th) => localStorage.setItem("hrms.theme", th), theme);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`web ${device} ${theme} ${name}: ${e.message}`));
    try {
      await page.goto(WEB + path, { timeout: 120000 });
      await settle(page);
      await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
    } catch (e) {
      errors.push(`web ${device} ${theme} ${name}: ${String(e.message).split("\n")[0]}`);
    }
    await ctx.close().catch(() => {});
    done++;
  }
  console.log(`done website ${device} ${theme}`);
}

const browser = await chromium.launch({ args: ["--disable-web-security", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
try {
  const owner = await appToken(OWNER);
  const data = await testData(owner);
  const jobs = [];
  if (process.env.ONLY !== "web") {
    for (const dev of pick(process.env.DEVICES, Object.keys(APP_DEVICES)).filter((x) => x in APP_DEVICES)) {
      for (const t of THEMES) jobs.push(() => appRun(browser, data, dev, t, { owner }));
    }
  }
  if (process.env.ONLY !== "app") {
    const states = { owner: await webLogin(browser, OWNER), employee: EMPLOYEE ? await webLogin(browser, EMPLOYEE) : undefined };
    for (const dev of pick(process.env.DEVICES, Object.keys(WEB_DEVICES)).filter((x) => x in WEB_DEVICES)) {
      for (const t of THEMES) jobs.push(() => webRun(browser, data, dev, t, states));
    }
  }
  const queue = [...jobs];
  await Promise.all(Array.from({ length: PARALLEL }, async () => { while (queue.length) await queue.shift()(); }));
} finally {
  await browser.close();
}
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/errors.txt`, errors.join("\n") + (errors.length ? "\n" : ""));
console.log(`${done} screenshots in ${OUT}/ at ${SCALE}x, ${errors.length} problem(s)${errors.length ? ` (see ${OUT}/errors.txt)` : ""}`);
process.exit(errors.length ? 1 : 0);
