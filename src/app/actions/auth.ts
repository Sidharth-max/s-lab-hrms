"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, issueOtp, normalizePhone, verifyOtp } from "@/lib/auth";
import { db } from "@/lib/db";
import { safe, str, type ActionResult } from "@/lib/action";

export const requestLoginOtp = safe(async (_prev: ActionResult, form: FormData): Promise<ActionResult> => {
  const phone = normalizePhone(str(form, "phone"));
  if (!phone) return { error: "Enter a valid 10 digit mobile number" };
  const user = await db.user.findUnique({ where: { phone } });
  // Same reply whether or not the number exists, so numbers cannot be probed.
  if (!user || !user.active) {
    return { ok: true, message: "If this number is registered, an OTP has been sent to", data: { phone } };
  }
  const r = await issueOtp(phone, "login");
  if (!r.ok) return { error: r.error };
  return { ok: true, message: "OTP sent to", data: { phone, devCode: r.devCode } };
});

export const verifyLoginOtp = safe(async (_prev: ActionResult, form: FormData): Promise<ActionResult> => {
  const phone = normalizePhone(str(form, "phone"));
  const code = str(form, "code");
  if (!phone || !/^\d{6}$/.test(code)) return { error: "Enter the 6 digit OTP", data: { phone } };
  const user = await db.user.findUnique({ where: { phone } });
  if (!user || !user.active || !(await verifyOtp(phone, "login", code))) {
    return { error: "Wrong or expired OTP", data: { phone } };
  }
  await createSession(user.id);
  redirect(user.role === "EMPLOYEE" ? "/me" : "/dashboard");
});

export async function logout() {
  await destroySession();
  redirect("/");
}
