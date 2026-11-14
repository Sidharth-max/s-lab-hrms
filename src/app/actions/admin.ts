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
import { readDayRulesForm } from "@/lib/day-rules";
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
  const week = readDayRulesForm((k) => str(form, k), (k) => form.get(k) === "on");
  if ("error" in week) return { error: week.error };
  const { weeklyOffDays, dayRules } = week;

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

// ---------- Shifts ----------

/** Creates a shift, or updates one when shiftId is sent. Same per-day fields as the business hours. */
export const saveShift = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("settings.manage");
  const name = str(form, "name");
  if (!name) return { error: "Enter the shift name" };
  if (name.length > 40) return { error: "Shift name: up to 40 letters" };
  const week = readDayRulesForm((k) => str(form, k), (k) => form.get(k) === "on");
  if ("error" in week) return { error: week.error };
  const id = str(form, "shiftId");
  const clash = await db.shift.findFirst({ where: { businessId: actor.businessId, name, ...(id ? { NOT: { id } } : {}) } });
  if (clash) return { error: "A shift with this name exists" };
  const data = { name, dayRules: week.dayRules as unknown as Prisma.InputJsonValue, weeklyOffDays: week.weeklyOffDays, active: true };
  let shiftId = id;
  if (id) {
    const cur = await db.shift.findFirst({ where: { id, businessId: actor.businessId } });
    if (!cur) return { error: "Shift not found" };
    await db.shift.update({ where: { id }, data });
    await audit(actor.businessId, actor.id, "shift.update", "Shift", id, data);
  } else {
    shiftId = (await db.shift.create({ data: { businessId: actor.businessId, ...data } })).id;
    await audit(actor.businessId, actor.id, "shift.create", "Shift", shiftId, data);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "Shift saved" : "Shift added", data: { id: shiftId } };
});

/** Website: save the shift and go back to Settings. */
export async function saveShiftAndReturn(prev: ActionResult, form: FormData): Promise<ActionResult> {
  const r = await saveShift(prev, form);
  if (r?.ok) redirect("/settings?shift=saved#shifts");
  return r;
}

/** Removes a shift. Its staff go back to the business hours. Past attendance is worked out again with those hours. */
export const removeShift = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("settings.manage");
  const shift = await db.shift.findFirst({ where: { id: str(form, "shiftId"), businessId: actor.businessId } });
  if (!shift) return { error: "Shift not found" };
  await db.$transaction([
    db.employee.updateMany({ where: { shiftId: shift.id }, data: { shiftId: null } }),
    // Renamed so the name can be used again for a new shift.
    db.shift.update({ where: { id: shift.id }, data: { active: false, name: `${shift.name} (removed ${shift.id.slice(-4)})` } }),
  ]);
  await audit(actor.businessId, actor.id, "shift.remove", "Shift", shift.id, { name: shift.name });
  revalidatePath("/", "layout");
  return { ok: true, message: "Shift removed" };
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

export const renameDevice = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("devices.register");
  const d = await db.device.findFirst({ where: { id: str(form, "deviceId"), businessId: actor.businessId } });
  if (!d) return { error: "Device not found" };
  const name = str(form, "name").slice(0, 60);
  if (!name) return { error: "Enter a name" };
  const siteId = str(form, "siteId") || d.siteId;
  const site = await db.site.findFirst({ where: { id: siteId, businessId: actor.businessId, active: true } });
  if (!site) return { error: "Choose a site" };
  await db.device.update({ where: { id: d.id }, data: { name, siteId: site.id } });
  await audit(actor.businessId, actor.id, "device.rename", "Device", d.id, { from: d.name, to: name, siteId: site.id });
  revalidatePath("/devices");
  return { ok: true, message: "Scanner saved" };
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
