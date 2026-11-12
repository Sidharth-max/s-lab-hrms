import { createSession, normalizePhone, verifyOtp } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api";

// Step 2 of app login: check the OTP and return a session token for the app to keep.
export async function POST(req: Request) {
  const body = await readJson(req);
  const phone = normalizePhone(String(body.phone ?? ""));
  const code = String(body.code ?? "").trim();
  if (!phone || !/^\d{6}$/.test(code)) return apiError("Enter the 6 digit OTP");
  const user = await db.user.findUnique({ where: { phone } });
  if (!user || !user.active || !(await verifyOtp(phone, "login", code))) return apiError("Wrong or expired OTP", 401);
  if (user.role === "EMPLOYEE") return apiError("The app is for owners and managers. Employees use the website.", 403);
  const token = await createSession(user.id, { cookie: false });
  return json({ ok: true, token });
}
