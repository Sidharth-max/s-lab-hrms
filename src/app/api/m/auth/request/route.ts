import { issueOtp, normalizePhone } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, json, readJson } from "@/lib/api";

// Step 1 of app login: send an OTP to the mobile number.
export async function POST(req: Request) {
  const body = await readJson(req);
  const phone = normalizePhone(String(body.phone ?? ""));
  if (!phone) return apiError("Enter a valid 10 digit mobile number");
  const user = await db.user.findUnique({ where: { phone } });
  // Same reply whether or not the number exists, so numbers cannot be probed.
  if (!user || !user.active) return json({ ok: true });
  const r = await issueOtp(phone, "login");
  if (!r.ok) return apiError(r.error, 429);
  return json({ ok: true, devCode: r.devCode });
}
