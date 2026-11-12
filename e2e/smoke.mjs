// End-to-end smoke test against a running server in TEST MODE (FACE_PROVIDER=mock, OTP_SHOW_IN_UI=true).
//   BASE_URL=http://localhost:3000 OWNER_PHONE=9876543210 node e2e/smoke.mjs
import { createRequire } from "node:module";
// Uses the preinstalled Playwright (set NODE_PATH to the global node_modules) or a local install.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OWNER = process.env.OWNER_PHONE ?? "9876543210";
const shots = process.env.SHOTS_DIR;

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, permissions: ["camera"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = (s) => console.log("•", s);
const shot = async (n) => shots && (await page.screenshot({ path: `${shots}/${n}.png`, fullPage: true }));

async function login(phone) {
  await page.goto(`${BASE}/login`);
  await page.fill("#phone", phone);
  await page.click("text=Get OTP");
  const code = (await page.locator("b.tracking-widest").textContent()).trim();
  await page.fill("#code", code);
  await page.click("button:has-text('Log in')");
}

step("owner logs in");
await login(OWNER);
await page.waitForURL("**/dashboard");
await shot("01-dashboard");

step("add employee (monthly, PF on)");
await page.goto(`${BASE}/employees/new`);
await page.fill("input[name=name]", "Ramesh Kumar");
await page.fill("input[name=code]", "E900");
await page.fill("input[name=phone]", "9123456789");
await page.fill("input[name=joinedOn]", "2026-10-01");
await page.fill("input[name=wage]", "15000");
await page.check("input[name=pfEnabled]");
await page.click("button:has-text('Add employee')");
await page.waitForURL(/employees\/[a-z0-9]+\?created=1/);
const empUrl = page.url().split("?")[0];

step("enroll face with camera");
await page.click("button:has-text('Enroll face')");
await page.waitForTimeout(1500);
await page.click("button:has-text('Take photo')");
await page.check("input[name=consent]");
await page.click("button:has-text('Save face')");
await page.waitForSelector("text=Face enrolled");

step("give advance within balance needs no approval");
await page.click("summary:has-text('Give advance')");
await page.fill("input[name=amount]", "50000");
await page.click("button:has-text('Save advance')");
await page.waitForSelector("text=Advance saved");
await shot("02-employee");

step("turn on employee web login");
await page.click("button:has-text('Turn on web login')");
await page.waitForSelector("text=Web login turned on");

step("add manager with limited permissions");
await page.goto(`${BASE}/team`);
await page.fill("input[name=name] >> nth=0", "Manager One");
await page.fill("input[name=phone] >> nth=0", "9000000001");
await page.check("input[value='advances.manage'] >> nth=0");
await page.click("button:has-text('Add manager')");
await page.waitForSelector("summary:has-text('Manager One')");

step("register this browser as scanner and scan");
await page.goto(`${BASE}/devices`);
await page.click("button:has-text('Make this device a scanner')");
await page.waitForURL("**/scan");
await page.waitForTimeout(1500);
await shot("03-scan");
await page.click("button[aria-label='Scan face']");
await page.click("button:has-text('Ramesh Kumar')");
await page.waitForSelector("text=हाज़िरी लग गई");
await shot("04-scan-ok");
await page.waitForTimeout(5000);
step("repeat scan is ignored");
await page.click("button[aria-label='Scan face']");
await page.click("button:has-text('Ramesh Kumar')");
await page.waitForSelector("text=पहले ही दर्ज है");

step("manager gives big advance -> needs approval");
await page.waitForTimeout(5000);
await login("9000000001");
await page.waitForURL("**/dashboard");
await page.goto(empUrl);
await page.click("summary:has-text('Give advance')");
await page.fill("input[name=amount]", "900000");
await page.click("button:has-text('Save advance')");
await page.waitForSelector("text=Sent for owner approval");
await page.goto(`${BASE}/approvals`);
await page.click("button:has-text('Send OTP to owner')");
const msg = await page.locator("p.text-green-700:has-text('test code')").first().textContent();
const code = /test code: (\d{6})/.exec(msg)[1];
await page.fill("input[name=code]", code);
await page.click("button:has-text('Approve with OTP')");
await page.waitForSelector("[role=status]:has-text('Approved by owner OTP')");

step("manager cannot open settings");
await page.goto(`${BASE}/settings`);
await page.waitForURL("**/dashboard?denied=1");

step("owner prepares and locks October salary");
await page.click("button:has-text('Log out')");
await login(OWNER);
await page.waitForURL("**/dashboard");
await page.goto(`${BASE}/payroll/2026-10`);
await page.click("button:has-text('Calculate salary')");
await page.waitForSelector("text=Salary calculated");
page.once("dialog", (d) => d.accept());
await page.click("button:has-text('Approve and lock')");
await page.waitForSelector("[role=status]:has-text('Salary locked')");
await shot("05-payroll");

step("employee portal");
await page.click("button:has-text('Log out')");
await login("9123456789");
await page.waitForURL("**/me");
await page.waitForSelector("text=Ramesh Kumar");
await shot("06-me");

await browser.close();
if (errors.length) {
  console.error("Page errors:", errors);
  process.exit(1);
}
console.log("SMOKE TEST PASSED");
