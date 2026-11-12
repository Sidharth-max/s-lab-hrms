import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { env, requireAuthSecret } from "./env";
import { can, type Actor, type Permission } from "./permissions";
import { sendOtpSms } from "./sms";

export const SESSION_COOKIE = "hrms_session";
export const DEVICE_COOKIE = "hrms_device";
const SESSION_DAYS = 30;
const OTP_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SENDS_PER_15_MIN = 5;

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashOtp(phone: string, purpose: string, code: string): string {
  return createHmac("sha256", requireAuthSecret()).update(`${phone}|${purpose}|${code}`).digest("hex");
}

/** Creates and sends an OTP. Returns the code only when OTP_SHOW_IN_UI is on (testing). */
export async function issueOtp(
  phone: string,
  purpose: string,
): Promise<{ ok: true; devCode?: string } | { ok: false; error: string }> {
  const since = new Date(Date.now() - 15 * 60000);
  const recent = await db.otpCode.count({ where: { phone, createdAt: { gte: since } } });
  if (recent >= OTP_MAX_SENDS_PER_15_MIN) return { ok: false, error: "Too many codes requested. Try again in 15 minutes." };

  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  await db.otpCode.updateMany({ where: { phone, purpose, usedAt: null }, data: { usedAt: new Date() } });
  await db.otpCode.create({
    data: { phone, purpose, codeHash: hashOtp(phone, purpose, code), expiresAt: new Date(Date.now() + OTP_MINUTES * 60000) },
  });
  try {
    await sendOtpSms(phone, code, purpose);
  } catch (e) {
    console.error("SMS send failed", e);
    if (!env.otpShowInUi) return { ok: false, error: "Could not send SMS. Try again." };
  }
  return { ok: true, devCode: env.otpShowInUi ? code : undefined };
}

export async function verifyOtp(phone: string, purpose: string, code: string): Promise<boolean> {
  const otp = await db.otpCode.findFirst({
    where: { phone, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) return false;
  const expected = Buffer.from(otp.codeHash, "hex");
  const actual = Buffer.from(hashOtp(phone, purpose, code.trim()), "hex");
  const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
  await db.otpCode.update({
    where: { id: otp.id },
    data: ok ? { usedAt: new Date() } : { attempts: { increment: 1 } },
  });
  return ok;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.secureCookies,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function getActor(): Promise<Actor | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  const u = session.user;
  return { id: u.id, businessId: u.businessId, role: u.role, permissions: u.permissions, siteIds: u.siteIds, name: u.name, phone: u.phone };
}

/** For owner/manager pages. Employees are sent to their portal. */
export async function requireStaff(permission?: Permission): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role === "EMPLOYEE") redirect("/me");
  if (permission && !can(actor, permission)) redirect("/dashboard?denied=1");
  return actor;
}

/** For server actions: throws instead of redirecting. */
export async function assertStaff(permission?: Permission): Promise<Actor> {
  const actor = await getActor();
  if (!actor || actor.role === "EMPLOYEE") throw new Error("Not signed in");
  if (permission && !can(actor, permission)) throw new Error("You do not have permission for this");
  return actor;
}

export async function requireOwner(): Promise<Actor> {
  const actor = await requireStaff();
  if (actor.role !== "OWNER") redirect("/dashboard?denied=1");
  return actor;
}

export async function getDevice() {
  const jar = await cookies();
  const token = jar.get(DEVICE_COOKIE)?.value;
  if (!token) return null;
  const device = await db.device.findUnique({ where: { tokenHash: hashToken(token) }, include: { site: true, business: true } });
  if (!device || device.revokedAt) return null;
  return device;
}
