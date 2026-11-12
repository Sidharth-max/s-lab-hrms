"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertStaff, DEVICE_COOKIE, destroySession, getActor, hashToken, normalizePhone } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isPermission } from "@/lib/permissions";
import { safe, str, type ActionResult } from "@/lib/action";
import { dateKeyToDb } from "@/lib/time";
import { isTime, type DayRule } from "@/lib/day-rules";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";

// ---------- Business settings ----------

function intIn(form: FormData, key: string, min: number, max: number, label: string) {
  const n = Number(str(form, key));
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}`);
  return n;
}

export const updateSettings = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("settings.manage");
  const name = str(form, "name");
  if (!name) return { error: "Enter the business name" };
  const pct = (k: string, label: string) => Math.round(intIn(form, k, 0, 100, label) * 100);

  // Weekly schedule: one row per weekday (0 = Sunday).
  const weeklyOffDays: number[] = [];
  const dayRules: DayRule[] = [];
  for (let i = 0; i < 7; i++) {
    const open = str(form, `open_${i}`);
    const close = str(form, `close_${i}`);
    if (!isTime(open) || !isTime(close)) return { error: "Enter open and close times as HH:MM" };
    const halfHours = Number(str(form, `half_${i}`) || "0");
    if (!Number.isFinite(halfHours) || halfHours < 0 || halfHours > 12) return { error: "Half day hours must be between 0 and 12" };
    if (form.get(`off_${i}`) === "on") weeklyOffDays.push(i);
    dayRules.push({ open, close, halfDayBelowMins: Math.round(halfHours * 60), anyScanFullDay: form.get(`any_${i}`) === "on" });
  }

  const data = {
    name,
    weeklyOffDays,
    dayRules: dayRules as unknown as Prisma.InputJsonValue,
    duplicateScanMins: intIn(form, "duplicateScanMins", 1, 60, "Repeat scan minutes"),
    maxShiftHours: intIn(form, "maxShiftHours", 4, 24, "Longest shift hours"),
    pfEmployeeBps: pct("pfEmployeePct", "PF employee %"),
    pfEmployerBps: pct("pfEmployerPct", "PF employer %"),
    pfWageCeiling: Math.round(intIn(form, "pfWageCeiling", 0, 10000000, "PF wage ceiling") * 100),
    esiEmployeeBps: pct("esiEmployeePct", "ESIC employee %"),
    esiEmployerBps: pct("esiEmployerPct", "ESIC employer %"),
  };
  await db.business.update({ where: { id: actor.businessId }, data });
  await audit(actor.businessId, actor.id, "settings.update", "Business", actor.businessId, data);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved" };
});

export const addSite = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("settings.manage");
  const name = str(form, "name");
  if (!name) return { error: "Enter the site name" };
  if (await db.site.findFirst({ where: { businessId: actor.businessId, name } })) return { error: "A site with this name exists" };
  const site = await db.site.create({ data: { businessId: actor.businessId, name } });
  await audit(actor.businessId, actor.id, "site.create", "Site", site.id, { name });
  revalidatePath("/settings");
  return { ok: true, message: "Site added" };
});

export const toggleSite = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("settings.manage");
  const site = await db.site.findFirst({ where: { id: str(form, "siteId"), businessId: actor.businessId } });
  if (!site) return { error: "Site not found" };
  await db.site.update({ where: { id: site.id }, data: { active: !site.active } });
  await audit(actor.businessId, actor.id, site.active ? "site.disable" : "site.enable", "Site", site.id);
  revalidatePath("/settings");
  return { ok: true };
});

export const addHoliday = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("settings.manage");
  const date = str(form, "date");
  const name = str(form, "name");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) return { error: "Enter date and name" };
  const locked = await db.payrollRun.findUnique({ where: { businessId_month: { businessId: actor.businessId, month: date.slice(0, 7) } } });
  if (locked?.status === "LOCKED") return { error: "Salary for that month is locked" };
  await db.holiday.upsert({
    where: { businessId_date: { businessId: actor.businessId, date: dateKeyToDb(date) } },
    create: { businessId: actor.businessId, date: dateKeyToDb(date), name },
    update: { name },
  });
  await audit(actor.businessId, actor.id, "holiday.add", "Holiday", null, { date, name });
  revalidatePath("/settings");
  return { ok: true, message: "Holiday saved", };
});

export const removeHoliday = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("settings.manage");
  const h = await db.holiday.findFirst({ where: { id: str(form, "holidayId"), businessId: actor.businessId } });
  if (!h) return { error: "Not found" };
  const locked = await db.payrollRun.findUnique({
    where: { businessId_month: { businessId: actor.businessId, month: h.date.toISOString().slice(0, 7) } },
  });
  if (locked?.status === "LOCKED") return { error: "Salary for that month is locked" };
  await db.holiday.delete({ where: { id: h.id } });
  await audit(actor.businessId, actor.id, "holiday.remove", "Holiday", h.id, { date: h.date.toISOString().slice(0, 10), name: h.name });
  revalidatePath("/settings");
  return { ok: true };
});

// ---------- Managers (owner only) ----------

async function assertOwner() {
  const actor = await assertStaff();
  if (actor.role !== "OWNER") throw new Error("Only the owner can manage managers");
  return actor;
}

function readPermissions(form: FormData) {
  return form.getAll("permissions").map(String).filter(isPermission);
}

export const saveManager = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertOwner();
  const id = str(form, "id");
  const name = str(form, "name");
  const phone = normalizePhone(str(form, "phone"));
  if (!name) return { error: "Enter the name" };
  if (!phone) return { error: "Enter a valid 10 digit mobile number" };
  const permissions = readPermissions(form);
  const validSites = await db.site.findMany({ where: { businessId: actor.businessId }, select: { id: true } });
  const siteIds = form.getAll("siteIds").map(String).filter((s) => validSites.some((v) => v.id === s));
  const clash = await db.user.findUnique({ where: { phone } });
  if (clash && clash.id !== id) return { error: "This mobile number already has a login" };

  if (id) {
    const m = await db.user.findFirst({ where: { id, businessId: actor.businessId, role: "MANAGER" } });
    if (!m) return { error: "Manager not found" };
    await db.user.update({ where: { id }, data: { name, phone, permissions, siteIds } });
    await audit(actor.businessId, actor.id, "manager.update", "User", id, { permissions, siteIds, before: { permissions: m.permissions, siteIds: m.siteIds } });
  } else {
    const u = await db.user.create({ data: { businessId: actor.businessId, role: "MANAGER", name, phone, permissions, siteIds } });
    await audit(actor.businessId, actor.id, "manager.create", "User", u.id, { name, permissions, siteIds });
  }
  revalidatePath("/team");
  return { ok: true, message: "Saved" };
});

export const toggleManager = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertOwner();
  const m = await db.user.findFirst({ where: { id: str(form, "id"), businessId: actor.businessId, role: "MANAGER" } });
  if (!m) return { error: "Manager not found" };
  await db.user.update({ where: { id: m.id }, data: { active: !m.active } });
  if (m.active) await db.session.deleteMany({ where: { userId: m.id } });
  await audit(actor.businessId, actor.id, m.active ? "manager.disable" : "manager.enable", "User", m.id);
  revalidatePath("/team");
  return { ok: true };
});

// ---------- Scanner devices ----------

/** Turns the current phone/tablet into a face scanner for a site. The login session is ended afterwards. */
export const registerDevice = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("devices.register");
  const site = await db.site.findFirst({ where: { id: str(form, "siteId"), businessId: actor.businessId, active: true } });
  if (!site) return { error: "Choose a site" };
  const name = str(form, "name") || `${site.name} scanner`;
  const token = randomBytes(32).toString("base64url");
  const device = await db.device.create({
    data: { businessId: actor.businessId, siteId: site.id, name, language: "en", tokenHash: hashToken(token), registeredBy: actor.id },
  });
  const jar = await cookies();
  jar.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.secureCookies,
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 10,
  });
  await audit(actor.businessId, actor.id, "device.register", "Device", device.id, { name, siteId: site.id });
  if (form.get("logout") === "on") {
    await destroySession();
    redirect("/scan");
  }
  revalidatePath("/devices");
  return { ok: true, message: "This device is now a scanner. Open Scan to start." };
});

export const revokeDevice = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("devices.register");
  const d = await db.device.findFirst({ where: { id: str(form, "deviceId"), businessId: actor.businessId, revokedAt: null } });
  if (!d) return { error: "Device not found" };
  await db.device.update({ where: { id: d.id }, data: { revokedAt: new Date() } });
  await audit(actor.businessId, actor.id, "device.revoke", "Device", d.id);
  revalidatePath("/devices");
  return { ok: true, message: "Device removed. It can no longer scan." };
});

/** Lets a manager leave the scanner screen to log in on this device. */
export async function scannerToLogin() {
  redirect("/login?from=scan");
}

export async function forgetThisDevice() {
  const actor = await getActor();
  if (!actor || actor.role === "EMPLOYEE") redirect("/login");
  const jar = await cookies();
  jar.delete(DEVICE_COOKIE);
  redirect("/devices");
}
