"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { assertStaff, normalizePhone } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { decodeImage, faceProvider } from "@/lib/face";
import { parseRs } from "@/lib/money";
import { can, canSeeSite } from "@/lib/permissions";
import { safe, str, type ActionResult } from "@/lib/action";
import { dateKeyToDb } from "@/lib/time";

async function loadEmployee(id: string, businessId: string) {
  const e = await db.employee.findFirst({ where: { id, businessId } });
  if (!e) throw new Error("Employee not found");
  return e;
}

function parsePay(form: FormData) {
  const wageType = str(form, "wageType") === "DAILY" ? "DAILY" : "MONTHLY";
  const amount = parseRs(str(form, "wage"));
  if (amount == null || amount <= 0) return { error: "Enter the wage amount" } as const;
  const basicPercent = Number(str(form, "basicPercent") || "100");
  if (!Number.isInteger(basicPercent) || basicPercent < 1 || basicPercent > 100) return { error: "Basic % must be 1 to 100" } as const;
  return {
    data: {
      wageType,
      monthlyWage: wageType === "MONTHLY" ? amount : 0,
      dailyWage: wageType === "DAILY" ? amount : 0,
      basicPercent,
      pfEnabled: form.get("pfEnabled") === "on",
      esiEnabled: form.get("esiEnabled") === "on",
    } as const,
  };
}

export const createEmployee = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("employees.manage");
  const name = str(form, "name");
  const code = str(form, "code").toUpperCase();
  const siteId = str(form, "siteId");
  const joinedOn = str(form, "joinedOn");
  const phoneRaw = str(form, "phone");
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (!name) return { error: "Enter the name" };
  if (!/^[A-Z0-9-]{1,12}$/.test(code)) return { error: "Employee code: letters/numbers, up to 12" };
  if (phoneRaw && !phone) return { error: "Enter a valid 10 digit mobile number" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) return { error: "Enter the joining date" };
  const site = await db.site.findFirst({ where: { id: siteId, businessId: actor.businessId, active: true } });
  if (!site || !canSeeSite(actor, site.id)) return { error: "Choose a site" };
  const pay = parsePay(form);
  if ("error" in pay) return { error: pay.error };
  // Without salary permission a manager can add the person but PF/ESIC stay off.
  const payData = can(actor, "salary.edit") ? pay.data : { ...pay.data, pfEnabled: false, esiEnabled: false };
  if (await db.employee.findFirst({ where: { businessId: actor.businessId, code } })) return { error: "This employee code is already used" };

  const emp = await db.employee.create({
    data: { businessId: actor.businessId, siteId, name, code, phone, joinedOn: dateKeyToDb(joinedOn), ...payData },
  });
  await audit(actor.businessId, actor.id, "employee.create", "Employee", emp.id, { name, code });
  revalidatePath("/employees", "layout");
  redirect(`/employees/${emp.id}?created=1`);
});

export const updateEmployee = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("employees.manage");
  const emp = await loadEmployee(str(form, "id"), actor.businessId);
  if (!canSeeSite(actor, emp.siteId)) return { error: "Not allowed for this site" };
  const name = str(form, "name");
  const siteId = str(form, "siteId");
  const phoneRaw = str(form, "phone");
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const joinedOn = str(form, "joinedOn");
  if (!name) return { error: "Enter the name" };
  if (phoneRaw && !phone) return { error: "Enter a valid 10 digit mobile number" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) return { error: "Enter the joining date" };
  const site = await db.site.findFirst({ where: { id: siteId, businessId: actor.businessId } });
  if (!site || !canSeeSite(actor, site.id)) return { error: "Choose a site" };

  const data: Prisma.EmployeeUpdateInput = { name, phone, site: { connect: { id: siteId } }, joinedOn: dateKeyToDb(joinedOn) };
  if (form.has("wage")) {
    if (!can(actor, "salary.edit")) return { error: "You cannot change salary" };
    const pay = parsePay(form);
    if ("error" in pay) return { error: pay.error };
    Object.assign(data, pay.data);
  }
  if (emp.userId && phone !== emp.phone) {
    if (!phone) return { error: "Turn off web login before removing the mobile number" };
    const clash = await db.user.findUnique({ where: { phone } });
    if (clash && clash.id !== emp.userId) return { error: "This mobile number is already used by another login" };
  }
  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: emp.id }, data });
    if (emp.userId && phone) await tx.user.update({ where: { id: emp.userId }, data: { phone, name } });
  });
  await audit(actor.businessId, actor.id, "employee.update", "Employee", emp.id, {
    before: { name: emp.name, wageType: emp.wageType, monthlyWage: emp.monthlyWage, dailyWage: emp.dailyWage, pf: emp.pfEnabled, esi: emp.esiEnabled },
  });
  revalidatePath("/employees", "layout");
  return { ok: true, message: "Saved" };
});

export const setEmployeeLeft = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("employees.manage");
  const emp = await loadEmployee(str(form, "id"), actor.businessId);
  const leftOn = str(form, "leftOn");
  if (!leftOn) {
    await db.employee.update({ where: { id: emp.id }, data: { leftOn: null, active: true } });
    await audit(actor.businessId, actor.id, "employee.rejoin", "Employee", emp.id);
    revalidatePath("/employees", "layout");
    return { ok: true, message: "Employee is active again" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leftOn)) return { error: "Enter the leaving date" };
  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: emp.id }, data: { leftOn: dateKeyToDb(leftOn), active: false, faceId: null, faceEnrolledAt: null } });
    if (emp.userId) await tx.user.update({ where: { id: emp.userId }, data: { active: false } });
  });
  // Remove the face so the person can no longer mark attendance. Attendance and salary history stay.
  if (emp.faceId) await faceProvider().remove(actor.businessId, emp.faceId).catch((e) => console.error("Face delete failed", e));
  await audit(actor.businessId, actor.id, "employee.left", "Employee", emp.id, { leftOn });
  revalidatePath("/employees", "layout");
  return { ok: true, message: "Marked as left. Face removed." };
});

export const enrollFace = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("employees.manage");
  const emp = await loadEmployee(str(form, "id"), actor.businessId);
  if (!emp.active) return { error: "Employee has left" };
  if (form.get("consent") !== "on") return { error: "Confirm the employee was told how the face is used" };
  const image = decodeImage(form.get("image"));
  if (!image) return { error: "Take a photo first" };
  const r = await faceProvider().enroll(actor.businessId, emp.id, image, emp.faceId);
  if (!r.ok) return { error: r.error };
  await db.employee.update({ where: { id: emp.id }, data: { faceId: r.faceId, faceEnrolledAt: new Date() } });
  await audit(actor.businessId, actor.id, "face.enroll", "Employee", emp.id);
  revalidatePath("/employees", "layout");
  return { ok: true, message: "Face enrolled" };
});

export const removeFace = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("employees.manage");
  const emp = await loadEmployee(str(form, "id"), actor.businessId);
  if (emp.faceId) await faceProvider().remove(actor.businessId, emp.faceId);
  await db.employee.update({ where: { id: emp.id }, data: { faceId: null, faceEnrolledAt: null } });
  await audit(actor.businessId, actor.id, "face.remove", "Employee", emp.id);
  revalidatePath("/employees", "layout");
  return { ok: true, message: "Face removed" };
});

/** Gives the employee a view-only web login using their mobile number. */
export const setEmployeeLogin = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("employees.manage");
  const emp = await loadEmployee(str(form, "id"), actor.businessId);
  const enable = str(form, "enable") === "1";
  if (!enable) {
    if (emp.userId) await db.user.update({ where: { id: emp.userId }, data: { active: false } });
    await audit(actor.businessId, actor.id, "employee.login.off", "Employee", emp.id);
    revalidatePath("/employees", "layout");
    return { ok: true, message: "Web login turned off" };
  }
  if (!emp.phone) return { error: "Add the employee's mobile number first" };
  const existing = await db.user.findUnique({ where: { phone: emp.phone } });
  if (existing && existing.id !== emp.userId) return { error: "This mobile number is already used by another login" };
  if (emp.userId) {
    await db.user.update({ where: { id: emp.userId }, data: { active: true, phone: emp.phone, name: emp.name } });
  } else {
    await db.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { businessId: actor.businessId, phone: emp.phone!, name: emp.name, role: "EMPLOYEE" } });
      await tx.employee.update({ where: { id: emp.id }, data: { userId: u.id } });
    });
  }
  await audit(actor.businessId, actor.id, "employee.login.on", "Employee", emp.id);
  revalidatePath("/employees", "layout");
  return { ok: true, message: "Web login turned on. The employee logs in with this mobile number and OTP." };
});
