// End-to-end test of the Android app API (/api/m) against a server in TEST MODE
// (FACE_PROVIDER=mock, OTP_SHOW_IN_UI=true) with a freshly seeded database.
//   BASE_URL=http://localhost:3000 OWNER_PHONE=9876543210 node e2e/api.mjs

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OWNER = process.env.OWNER_PHONE ?? "9876543210";
let token = "";
let deviceToken = "";

function check(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function call(method, path, body, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const step = (s) => console.log("•", s);

step("unauthenticated calls are refused");
check((await call("GET", "/api/m/me")).status === 401, "me without token should be 401");

step("login with OTP returns a token");
let r = await call("POST", "/api/m/auth/request", { phone: OWNER });
check(r.data.ok && r.data.devCode, "request OTP failed: " + JSON.stringify(r.data));
r = await call("POST", "/api/m/auth/verify", { phone: OWNER, code: "000000" });
check(r.status === 401, "wrong OTP must fail");
r = await call("POST", "/api/m/auth/request", { phone: OWNER });
r = await call("POST", "/api/m/auth/verify", { phone: OWNER, code: r.data.devCode });
check(r.data.token, "verify failed: " + JSON.stringify(r.data));
token = r.data.token;

step("profile and sites");
r = await call("GET", "/api/m/me");
check(r.data.user?.role === "OWNER" && r.data.sites.length > 0, "me failed: " + JSON.stringify(r.data));
const siteId = r.data.sites[0].id;

step("add employee");
r = await call("POST", "/api/m/employees", {
  name: "Api Worker", code: "A100", phone: "9123400001", siteId, joinedOn: "2026-10-01", wageType: "DAILY", wage: "600", esiEnabled: true,
});
check(r.data.ok && r.data.data?.id, "create employee failed: " + JSON.stringify(r.data));
const empId = r.data.data.id;
r = await call("POST", "/api/m/employees", { name: "Dup", code: "A100", siteId, joinedOn: "2026-10-01", wageType: "DAILY", wage: "600" });
check(r.status === 400 && /already used/.test(r.data.error), "duplicate code should be refused");

step("employee code is filled in automatically when left empty");
r = await call("GET", "/api/m/employees");
check(/^E\d{3}$/.test(r.data.nextCode), "nextCode missing: " + JSON.stringify(r.data.nextCode));
const expected = r.data.nextCode;
r = await call("POST", "/api/m/employees", { name: "Auto Code", siteId, joinedOn: "2026-10-01", wageType: "MONTHLY", wage: "9000" });
check(r.data.ok, "create without code failed: " + JSON.stringify(r.data));
r = await call("GET", `/api/m/employees/${r.data.data.id}`);
check(r.data.employee?.code === expected, `auto code should be ${expected}, got ${r.data.employee?.code}`);

step("new app screens load");
for (const p of ["/api/m/settings", "/api/m/team", "/api/m/audit", "/api/m/devices", "/api/m/register"]) {
  r = await call("GET", p);
  check(r.status === 200, `${p} returned ${r.status}`);
}

step("employee detail");
r = await call("GET", `/api/m/employees/${empId}`);
check(r.data.employee?.wage === 60000 && r.data.employee.esiEnabled === true, "detail wrong: " + JSON.stringify(r.data.employee));

step("enroll face (test mode)");
const fakeJpeg = "data:image/jpeg;base64," + Buffer.alloc(2000, 7).toString("base64");
r = await call("POST", "/api/m/action/enrollFace", { id: empId, image: fakeJpeg, consent: true });
check(r.data.ok, "enroll failed: " + JSON.stringify(r.data));

step("register this app as a scanner and scan");
r = await call("POST", "/api/m/devices/register", { siteId, name: "API tablet" });
check(r.data.deviceToken, "register failed: " + JSON.stringify(r.data));
deviceToken = r.data.deviceToken;
const saved = token;
token = ""; // scanner uses only the device token
r = await call("GET", "/api/scan", null, { "X-Device-Token": deviceToken });
check(r.data.registered && r.data.testEmployees.some((e) => e.id === empId), "scan config failed: " + JSON.stringify(r.data));
r = await call("POST", "/api/scan", { image: fakeJpeg, mockEmployeeId: empId }, { "X-Device-Token": deviceToken });
check(r.data.ok && r.data.type === "IN", "scan failed: " + JSON.stringify(r.data));
r = await call("POST", "/api/scan", { image: fakeJpeg, mockEmployeeId: empId }, { "X-Device-Token": deviceToken });
check(r.data.ok && r.data.duplicate, "repeat scan should be duplicate");
token = saved;

step("today and attendance");
r = await call("GET", "/api/m/dashboard");
check(r.data.rows.find((x) => x.id === empId)?.inAt, "dashboard should show IN");
r = await call("GET", "/api/m/attendance");
const today = r.data.date;
check(r.data.rows.some((x) => x.employeeId === empId && x.status === "PRESENT"), "attendance should be PRESENT");
r = await call("POST", "/api/m/action/setDayStatus", { employeeId: empId, date: today, status: "PAID_LEAVE", reason: "app test" });
check(r.data.ok, "set status failed: " + JSON.stringify(r.data));
r = await call("GET", `/api/m/attendance/${empId}/${today}`);
check(r.data.status === "PAID_LEAVE" && r.data.punches.length === 1 && r.data.history.length === 1, "day detail wrong: " + JSON.stringify(r.data));

step("advance and salary");
r = await call("POST", "/api/m/action/giveAdvance", { employeeId: empId, amount: "100", recoveryMonths: "1" });
check(r.data.ok, "advance failed: " + JSON.stringify(r.data));
r = await call("GET", "/api/m/advances");
check(r.data.advances.some((a) => a.employeeId === empId), "advance missing");
const month = today.slice(0, 7);
r = await call("POST", "/api/m/action/recalcPayroll", { month });
check(r.data.ok, "recalc failed: " + JSON.stringify(r.data));
r = await call("GET", `/api/m/payroll/${month}`);
const line = r.data.lines.find((l) => l.employeeId === empId);
check(line && line.gross === 60000 && line.advance === 10000, "salary line wrong: " + JSON.stringify(line));

step("unknown action and logout");
check((await call("POST", "/api/m/action/deleteEverything", {})).status === 404, "unknown action should 404");
r = await call("POST", "/api/m/auth/logout");
check((await call("GET", "/api/m/me")).status === 401, "token should stop working after logout");

console.log("API TEST PASSED");
