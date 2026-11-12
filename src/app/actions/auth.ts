"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, issueOtp, normalizePhone, verifyOtp } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isLang, LANG_COOKIE } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";
import { safe, str, type ActionResult } from "@/lib/action";

export const requestLoginOtp = safe(async (_prev: ActionResult, form: FormData): Promise<ActionResult> => {
  const { t } = await getT();
  const phone = normalizePhone(str(form, "phone"));
  if (!phone) return { error: t("Enter a valid 10 digit mobile number", "सही 10 अंक का मोबाइल नंबर डालें") };
  const user = await db.user.findUnique({ where: { phone } });
  // Same reply whether or not the number exists, so numbers cannot be probed.
  if (!user || !user.active) {
    return { ok: true, message: t("If this number is registered, an OTP has been sent to", "अगर यह नंबर रजिस्टर है, तो OTP भेजा गया है"), data: { phone } };
  }
  const r = await issueOtp(phone, "login");
  if (!r.ok) return { error: r.error };
  return { ok: true, message: t("OTP sent to", "OTP भेजा गया"), data: { phone, devCode: r.devCode } };
});

export const verifyLoginOtp = safe(async (_prev: ActionResult, form: FormData): Promise<ActionResult> => {
  const { t, lang } = await getT();
  const phone = normalizePhone(str(form, "phone"));
  const code = str(form, "code");
  if (!phone || !/^\d{6}$/.test(code)) return { error: t("Enter the 6 digit OTP", "6 अंक का OTP डालें"), data: { phone } };
  const user = await db.user.findUnique({ where: { phone } });
  if (!user || !user.active || !(await verifyOtp(phone, "login", code))) {
    return { error: t("Wrong or expired OTP", "OTP गलत है या समय ख़त्म हो गया"), data: { phone } };
  }
  // A language picked on this device's login screen is saved for the user;
  // otherwise the user's saved language is applied to this device.
  const jar = await cookies();
  if (jar.get(LANG_COOKIE)) {
    if (user.language !== lang) await db.user.update({ where: { id: user.id }, data: { language: lang } });
  } else if (isLang(user.language)) {
    jar.set(LANG_COOKIE, user.language, { path: "/", sameSite: "lax", secure: env.secureCookies, maxAge: 60 * 60 * 24 * 365 * 5 });
  }
  await createSession(user.id);
  redirect(user.role === "EMPLOYEE" ? "/me" : "/dashboard");
});

export async function logout() {
  await destroySession();
  redirect("/");
}
