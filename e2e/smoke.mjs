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
process.on("unhandledRejection", async (e) => {
  console.error(e);
  if (shots) await page.screenshot({ path: `${shots}/FAIL.png`, fullPage: true }).catch(() => {});
  process.exit(1);
});
const shot = async (n) => shots && (await page.screenshot({ path: `${shots}/${n}.png`, fullPage: true }));

async function login(phone) {
  await page.goto(`${BASE}/login`);
  await page.fill("#phone", phone);
  await page.click("text=Get OTP");
  const code = (await page.locator("b.tracking-widest").textContent()).trim();
  await page.fill("#code", code);
  await page.click("button:has-text('Log in')");
}

try {
step("owner logs in");
await login(OWNER);
await page.waitForURL("**/dashboard");
await shot("01-dashboard");

step("add employee (monthly, PF on)");
await page.goto(`${BASE}/employees/new`);
await page.fill("input[name=name]", "Ramesh Kumar");
await page.fill("input[name=code]", "E900");
await page.fill("input[name=phone]", "9123456789");
// Our date picker: open it, go back to October 2026 and pick the 1st.
await page.click("input[name=joinedOn] + button");
while (!(await page.locator("[role=dialog][aria-label='Choose date'] >> text=Oct 2026").count())) {
  await page.click("[role=dialog][aria-label='Choose date'] button[aria-label='Previous month']");
}
await page.click("[role=dialog][aria-label='Choose date'] button:text-is('1')");
if ((await page.inputValue("input[name=joinedOn]")) !== "2026-10-01") throw new Error("date picker did not set the joining date");
await page.fill("input[name=wage]", "15000");
await page.check("input[name=pfEnabled]");
await page.click("button:has-text('Add employee')");
await page.waitForURL(/employees\/[a-z0-9]+\?created=1/);
const empUrl = page.url().split("?")[0];

step("enroll face with camera");
await page.click("button:has-text('Enroll face')");
await page.waitForTimeout(1500);
await page.click("button:has-text('Start face scan')");
await page.waitForSelector("text=Scan complete", { timeout: 60000 });
await page.check("input[name=consent]");
await page.click("button:has-text('Save face')");
await page.waitForSelector("text=Face enrolled (5 photos)");

step("give advance within balance needs no approval");
await page.click("button[role=tab]:has-text('Advance')");
await page.click("summary:has-text('Give advance')");
await page.fill("input[name=amount]", "50000");
await page.click("button:has-text('Save advance')");
await page.waitForSelector("text=Advance saved");
await shot("02-employee");

step("edit employee from the Edit button");
await page.goto(empUrl);
await page.click("a:has-text('Edit') >> nth=0");
await page.waitForURL(/\/edit$/);
await page.fill("input[name=name]", "Ramesh Kumar Sharma");
await page.click("button:has-text('Save changes')");
await page.waitForSelector("text=Changes saved");
await page.waitForSelector("h1:has-text('Ramesh Kumar Sharma')");
await page.goto(empUrl);

step("turn on employee web login");
await page.click("button[role=tab]:has-text('Access & archive')");
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
await page.waitForSelector("text=Checked in");
await shot("04-scan-ok");
await page.waitForTimeout(5000);
step("repeat scan is ignored");
await page.click("button[aria-label='Scan face']");
await page.click("button:has-text('Ramesh Kumar')");
await page.waitForSelector("text=Already marked");

step("manager gives big advance -> needs approval");
await page.waitForTimeout(5000);
await login("9000000001");
await page.waitForURL("**/dashboard");
await page.goto(empUrl + "?advance=1");
await page.fill("input[name=amount]", "900000");
await page.click("button:has-text('Save advance')");
await page.waitForSelector("text=Sent for approval");
await page.goto(`${BASE}/approvals`);
await page.click("button:has-text('Send OTP to owner')");
const msg = await page.locator("p:has-text('test code')").first().textContent();
const code = /test code: (\d{6})/.exec(msg)[1];
await page.fill("input[name=code]", code);
await page.click("button:has-text('Approve with OTP')");
await page.waitForSelector("[role=status]:has-text('Approved by owner OTP')");

step("manager cannot open settings");
await page.goto(`${BASE}/settings`);
await page.waitForURL("**/dashboard?denied=1");

step("owner sees the salary hisaab and adds extra pay");
await page.click("button[aria-label^='Log out']");
await login(OWNER);
await page.waitForURL("**/dashboard");
await page.goto(`${BASE}/payroll`);
await page.waitForURL("**/salary");
await page.waitForSelector("text=Total to pay");
await page.click("a:has-text('Ramesh Kumar')");
await page.waitForSelector("h2:has-text('Hisaab')");
const extra = page.locator("details:has(summary:has-text('Add extra pay'))");
await extra.locator("summary").click();
await extra.locator("input[name=amount]").fill("500");
await extra.locator("input[name=reason]").fill("qa bonus");
await extra.locator("button:has-text('Save')").click();
await page.waitForSelector("[role=status]:has-text('Extra pay added')");
await page.waitForSelector("text=qa bonus");
await shot("05-salary");

step("phone menu opens and has no language switch");
await page.click("button[aria-label=More]");
await page.waitForSelector("text=Download Android app >> visible=true");
if (await page.locator("text=हिंदी").count()) throw new Error("Hindi still present");
await page.click("button[aria-label=More]");

step("open foldable: list and details side by side");
const fold = await browser.newContext({ viewport: { width: 884, height: 1104 } });
await fold.addCookies(await ctx.cookies());
const fp = await fold.newPage();
fp.on("pageerror", (e) => errors.push(e.message));
await fp.goto(empUrl);
await fp.waitForSelector("aside >> text=Ramesh Kumar");
await fp.waitForSelector("h1:has-text('Ramesh Kumar')");
if (!(await fp.locator("aside").isVisible())) throw new Error("list pane hidden on foldable");
if (await fp.locator("button[role=tab]").first().isVisible()) console.log("  (tabs shown in narrow detail pane)");
if (shots) await fp.screenshot({ path: `${shots}/07-foldable.png` });
await fold.close();

step("weekly schedule: Sunday short day saved in settings");
await page.goto(`${BASE}/settings`);
if (!(await page.isChecked("input[name=any_0]"))) throw new Error("Sunday should default to any scan = full day");
if ((await page.inputValue("input[name=close_0]")) !== "15:00") throw new Error("Sunday should close at 15:00");
await page.check("input[name=off_6]"); // make Saturday a weekly off
await page.click("button:has-text('Save') >> nth=0");
await page.waitForSelector("[role=status]:has-text('Saved')");
await page.reload();
if (!(await page.isChecked("input[name=off_6]"))) throw new Error("Saturday weekly off not saved");

step("employee portal");
await page.click("button[aria-label^='Log out']");
await login("9123456789");
await page.waitForURL("**/me");
await page.waitForSelector("text=Ramesh Kumar");
await shot("08-me");

} catch (e) {
  if (shots) await page.screenshot({ path: `${shots}/FAIL.png`, fullPage: true }).catch(() => {});
  await browser.close();
  throw e;
}
await browser.close();
if (errors.length) {
  console.error("Page errors:", errors);
  process.exit(1);
}
console.log("SMOKE TEST PASSED");
