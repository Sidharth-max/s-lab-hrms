"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { assertStaff, normalizePhone } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { decodeImage, faceProvider, storedFaceIds } from "@/lib/face";
import { parseRs } from "@/lib/money";
import { can, canSeeSite } from "@/lib/permissions";
import { safe, str, type ActionResult } from "@/lib/action";
import { titleCase } from "@/lib/text";
import { dateKeyToDb, dbToDateKey, istDateKey } from "@/lib/time";
import { setWageFrom } from "@/lib/ledger";
import { nextEmployeeCode } from "@/lib/services";

function parseWeeklyOff(form: FormData) {
  const customWeeklyOff = str(form, "weeklyOffMode") === "custom";
  const weeklyOffDays = customWeeklyOff
    ? [...new Set(form.getAll("empWeeklyOff").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  return { customWeeklyOff, weeklyOffDays };
}

/** Shift chosen on the form: "" = business hours. Undefined when the form has no shift field (older app versions). */
async function parseShift(form: FormData, businessId: string): Promise<{ shiftId?: string | null } | { error: string }> {
  if (!form.has("shiftId")) return {};
  const id = str(form, "shiftId");
  if (!id) return { shiftId: null };
  const shift = await db.shift.findFirst({ where: { id, businessId, active: true } });
  if (!shift) return { error: "Choose a shift" };
  return { shiftId: shift.id };
}

async function loadEmployee(id: string, businessId: string) {
  const e = await db.employee.findFirst({ where: { id, businessId } });
  if (!e) throw new Error("Employee not found");
  return e;
}

function parsePay(form: FormData) {
  const wageType = str(form, "wageType") === "DAILY" ? "DAILY" : "MONTHLY";
  // New forms send the bank and cash parts (total = bank + cash; PF / ESIC on the bank part only).
  // Older app versions send one "wage" amount: treated as all bank, as before.
  let amount: number | null;
  let cashWage = 0;
  if (form.has("bankWage") || form.has("cashWage")) {
    const bank = str(form, "bankWage") ? parseRs(str(form, "bankWage")) : 0;
    const cash = str(form, "cashWage") ? parseRs(str(form, "cashWage")) : 0;
    if (bank == null || bank < 0 || cash == null || cash < 0) return { error: "Enter the bank and cash amounts" } as const;
    amount = bank + cash;
    cashWage = cash;
  } else {
    amount = parseRs(str(form, "wage"));
  }
  if (amount == null || amount <= 0) return { error: "Enter the wage amount" } as const;
  const basicPercent = Number(str(form, "basicPercent") || "100");
  const pfEnabled = form.get("pfEnabled") === "on";
  const esiEnabled = form.get("esiEnabled") === "on";
  // Numbers are optional (they can be added later), but must look right when given.
  const uanNumber = str(form, "uanNumber").replace(/\s/g, "") || null;
  const esicNumber = str(form, "esicNumber").replace(/\s/g, "") || null;
  if (uanNumber && !/^\d{12}$/.test(uanNumber)) return { error: "PF UAN must be 12 digits" } as const;
  if (esicNumber && !/^\d{10}$/.test(esicNumber)) return { error: "ESIC IP number must be 10 digits" } as const;
  if (!Number.isInteger(basicPercent) || basicPercent < 1 || basicPercent > 100) return { error: "Basic % must be 1 to 100" } as const;
  return {
    data: {
      wageType,
      monthlyWage: wageType === "MONTHLY" ? amount : 0,
      dailyWage: wageType === "DAILY" ? amount : 0,
      cashWage,
      basicPercent,
      pfEnabled,
      esiEnabled,
      uanNumber: pfEnabled ? uanNumber : null,
      esicNumber: esiEnabled ? esicNumber : null,
    } as const,
  };
}

/**
 * Bank details (all optional). The bank and branch names are looked up from the IFSC (Razorpay's
 * public IFSC directory, only the IFSC code is sent); if that fails the details still save.
 */
async function parseBank(form: FormData, before?: { bankIfsc: string | null; bankName: string | null; bankBranch: string | null }) {
  if (!form.has("bankAccountNumber") && !form.has("bankIfsc") && !form.has("upiId") && !form.has("bankAccountName")) return { data: null } as const;
  const bankAccountName = titleCase(str(form, "bankAccountName")) || null;
  const bankAccountNumber = str(form, "bankAccountNumber").replace(/[\s-]/g, "") || null;
  const confirm = str(form, "bankAccountNumber2").replace(/[\s-]/g, "");
  const bankIfsc = str(form, "bankIfsc").replace(/\s/g, "").toUpperCase() || null;
  const upiId = str(form, "upiId").replace(/\s/g, "") || null;
  if (bankAccountNumber && !/^\d{9,18}$/.test(bankAccountNumber)) return { error: "Bank account number must be 9 to 18 digits" } as const;
  if (form.has("bankAccountNumber2") && bankAccountNumber && confirm !== bankAccountNumber) return { error: "The two account numbers do not match" } as const;
  if (bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)) return { error: "IFSC must look like SBIN0001234 (11 characters)" } as const;
  if (upiId && !/^[\w.-]{2,}@[a-zA-Z][\w.-]{1,}$/.test(upiId)) return { error: "UPI ID must look like name@bank" } as const;
  let bankName = before?.bankIfsc === bankIfsc ? before?.bankName ?? null : null;
  let bankBranch = before?.bankIfsc === bankIfsc ? before?.bankBranch ?? null : null;
  if (bankIfsc && bankIfsc !== before?.bankIfsc) {
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${bankIfsc}`, { signal: AbortSignal.timeout(4000) });
      if (res.status === 404) return { error: "This IFSC was not found. Check it on the cheque book or passbook." } as const;
      if (res.ok) {
        const j = (await res.json()) as { BANK?: string; BRANCH?: string };
        bankName = j.BANK ? titleCase(j.BANK) : null;
        bankBranch = j.BRANCH ? titleCase(j.BRANCH) : null;
      }
    } catch {
      // Lookup not reachable: save without the bank / branch name.
    }
  }
  return { data: { bankAccountName, bankAccountNumber, bankIfsc, bankName, bankBranch, upiId } } as const;
}

/** Creates the employee; returns its id (used by the website action below and the Android app API). */
export const createEmployeeCore = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("employees.manage");
  const name = titleCase(str(form, "name"));
  // Left empty: the next free code (E001, E002, …) is used.
  const code = str(form, "code").toUpperCase() || (await nextEmployeeCode(actor.businessId));
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
  const payData = can(actor, "salary.edit") ? pay.data : { ...pay.data, pfEnabled: false, esiEnabled: false, uanNumber: null, esicNumber: null };
  if (await db.employee.findFirst({ where: { businessId: actor.businessId, code } })) return { error: "This employee code is already used" };
  const bank = can(actor, "salary.edit") ? await parseBank(form) : { data: null };
  if ("error" in bank) return { error: bank.error };
  const shift = await parseShift(form, actor.businessId);
  if ("error" in shift) return { error: shift.error };

  const emp = await db.$transaction(async (tx) => {
    const e = await tx.employee.create({
      data: { businessId: actor.businessId, siteId, name, code, phone, joinedOn: dateKeyToDb(joinedOn), inHouse: form.get("inHouse") === "on", ...payData, ...(bank.data ?? {}), ...parseWeeklyOff(form), ...shift },
    });
    await setWageFrom(e.id, joinedOn, { wageType: e.wageType, monthlyWage: e.monthlyWage, dailyWage: e.dailyWage, cashWage: e.cashWage }, actor.id, tx);
    return e;
  });
  await audit(actor.businessId, actor.id, "employee.create", "Employee", emp.id, { name, code });
  revalidatePath("/employees", "layout");
  return { ok: true, message: "Employee added", data: { id: emp.id } };
});

export async function createEmployee(prev: ActionResult, form: FormData): Promise<ActionResult> {
  const r = await createEmployeeCore(prev, form);
  if (r?.ok && typeof r.data?.id === "string") redirect(`/employees/${r.data.id}?created=1`);
  return r;
}

export const updateEmployee = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("employees.manage");
  const emp = await loadEmployee(str(form, "id"), actor.businessId);
  if (!canSeeSite(actor, emp.siteId)) return { error: "Not allowed for this site" };
  const name = titleCase(str(form, "name"));
  const siteId = str(form, "siteId");
  const phoneRaw = str(form, "phone");
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const joinedOn = str(form, "joinedOn");
  if (!name) return { error: "Enter the name" };
  if (phoneRaw && !phone) return { error: "Enter a valid 10 digit mobile number" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) return { error: "Enter the joining date" };
  const site = await db.site.findFirst({ where: { id: siteId, businessId: actor.businessId } });
  if (!site || !canSeeSite(actor, site.id)) return { error: "Choose a site" };

  const shift = await parseShift(form, actor.businessId);
  if ("error" in shift) return { error: shift.error };
  const data: Prisma.EmployeeUpdateInput = { name, phone, site: { connect: { id: siteId } }, joinedOn: dateKeyToDb(joinedOn), inHouse: form.get("inHouse") === "on", ...parseWeeklyOff(form) };
  if (shift.shiftId !== undefined) data.shift = shift.shiftId ? { connect: { id: shift.shiftId } } : { disconnect: true };
  // A new salary applies from a chosen day; days before it keep the old salary.
  let wageChange: { from: string; rate: { wageType: "MONTHLY" | "DAILY"; monthlyWage: number; dailyWage: number; cashWage: number } } | null = null;
  if (form.has("wage") || form.has("bankWage") || form.has("cashWage")) {
    if (!can(actor, "salary.edit")) return { error: "You cannot change salary" };
    const pay = parsePay(form);
    if ("error" in pay) return { error: pay.error };
    Object.assign(data, pay.data);
    const rate = { wageType: pay.data.wageType, monthlyWage: pay.data.monthlyWage, dailyWage: pay.data.dailyWage, cashWage: pay.data.cashWage };
    if (rate.wageType !== emp.wageType || rate.monthlyWage !== emp.monthlyWage || rate.dailyWage !== emp.dailyWage || rate.cashWage !== emp.cashWage) {
      let from = str(form, "wageFrom") || istDateKey(new Date());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return { error: "Choose the day the new salary starts" };
      if (from < joinedOn) from = joinedOn;
      wageChange = { from, rate };
    }
  }
  // Bank details: same permission as salary.
  if (form.has("bankAccountNumber") || form.has("bankIfsc") || form.has("upiId") || form.has("bankAccountName")) {
    if (!can(actor, "salary.edit")) return { error: "You cannot change bank details" };
    const bank = await parseBank(form, emp);
    if ("error" in bank) return { error: bank.error };
    if (bank.data) Object.assign(data, bank.data);
  }
  if (emp.userId && phone !== emp.phone) {
    if (!phone) return { error: "Turn off web login before removing the mobile number" };
    const clash = await db.user.findUnique({ where: { phone } });
    if (clash && clash.id !== emp.userId) return { error: "This mobile number is already used by another login" };
  }
  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: emp.id }, data });
    if (emp.userId && phone) await tx.user.update({ where: { id: emp.userId }, data: { phone, name } });
    if (wageChange) {
      // Keep the old salary for the days before the change (older records may have no history yet).
      if ((await tx.wageChange.count({ where: { employeeId: emp.id } })) === 0) {
        await setWageFrom(emp.id, dbToDateKey(emp.joinedOn), { wageType: emp.wageType, monthlyWage: emp.monthlyWage, dailyWage: emp.dailyWage, cashWage: emp.cashWage }, null, tx);
      }
      // The new salary is the current one, so any change planned after its start is replaced.
      await tx.wageChange.deleteMany({ where: { employeeId: emp.id, effectiveFrom: { gt: dateKeyToDb(wageChange.from) } } });
      await setWageFrom(emp.id, wageChange.from, wageChange.rate, actor.id, tx);
    }
  });
  if (wageChange) {
    const wage = (r: { wageType: string; monthlyWage: number; dailyWage: number }) => (r.wageType === "MONTHLY" ? r.monthlyWage : r.dailyWage);
    await audit(actor.businessId, actor.id, "employee.wage", "Employee", emp.id, { from: wageChange.from, before: wage(emp), after: wage(wageChange.rate), wageType: wageChange.rate.wageType });
  }
  await audit(actor.businessId, actor.id, "employee.update", "Employee", emp.id, {
    before: { name: emp.name, wageType: emp.wageType, monthlyWage: emp.monthlyWage, dailyWage: emp.dailyWage, pf: emp.pfEnabled, esi: emp.esiEnabled },
  });
  revalidatePath("/employees", "layout");
  return { ok: true, message: "Saved" };
});

/** Website edit page: save, then go back to the employee. */
export async function updateEmployeeAndReturn(prev: ActionResult, form: FormData): Promise<ActionResult> {
  const r = await updateEmployee(prev, form);
  if (r?.ok) redirect(`/employees/${str(form, "id")}?saved=1`);
  return r;
}

export const setEmployeeLeft = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("employees.manage");
  const emp = await loadEmployee(str(form, "id"), actor.businessId);
  const leftOn = str(form, "leftOn");
  if (!leftOn) {
    await db.employee.update({ where: { id: emp.id }, data: { leftOn: null, active: true } });
    await audit(actor.businessId, actor.id, "employee.rejoin", "Employee", emp.id);
    revalidatePath("/employees", "layout");
    return { ok: true, message: "Employee restored from the archive" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leftOn)) return { error: "Enter the last working day" };
  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: emp.id }, data: { leftOn: dateKeyToDb(leftOn), active: false, faceId: null, faceIds: [], faceEnrolledAt: null } });
    if (emp.userId) await tx.user.update({ where: { id: emp.userId }, data: { active: false } });
    // Leave planned after the last working day no longer applies.
    const last = dateKeyToDb(leftOn);
    await tx.leavePlan.updateMany({ where: { employeeId: emp.id, status: "ACTIVE", fromDate: { gt: last } }, data: { status: "CANCELLED" } });
    await tx.leavePlan.updateMany({ where: { employeeId: emp.id, status: "ACTIVE", toDate: { gt: last } }, data: { toDate: last } });
  });
  // Remove the face so the person can no longer mark attendance. Attendance and salary history stay.
  const faces = storedFaceIds(emp);
  if (faces.length) await faceProvider().remove(actor.businessId, faces).catch((e) => console.error("Face delete failed", e));
  await audit(actor.businessId, actor.id, "employee.left", "Employee", emp.id, { leftOn });
  revalidatePath("/employees", "layout");
  return { ok: true, message: "Employee archived. Face removed; attendance and salary history are kept." };
});

export const enrollFace = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("employees.manage");
  const emp = await loadEmployee(str(form, "id"), actor.businessId);
  if (!emp.active) return { error: "This employee is archived. Restore them first." };
  if (form.get("consent") !== "on") return { error: "Confirm the employee was told how the face is used" };
  // Up to 5 photos of the same person (straight, a little left, a little right) make recognition more reliable.
  const raw = form.getAll("image").filter((v) => typeof v === "string" && v);
  if (raw.length === 0) return { error: "Take a photo first" };
  if (raw.length > 5) return { error: "Use at most 5 photos" };
  const images = raw.map(decodeImage);
  if (images.some((i) => !i)) return { error: "A photo could not be read. Take the photos again." };
  const r = await faceProvider().enroll(actor.businessId, emp.id, images as Buffer[], storedFaceIds(emp));
  if (!r.ok) return { error: r.error };
  await db.employee.update({ where: { id: emp.id }, data: { faceId: r.faceIds[0], faceIds: r.faceIds, faceEnrolledAt: new Date() } });
  await audit(actor.businessId, actor.id, "face.enroll", "Employee", emp.id, { photos: r.faceIds.length });
  revalidatePath("/employees", "layout");
  return { ok: true, message: r.faceIds.length > 1 ? `Face enrolled (${r.faceIds.length} photos)` : "Face enrolled" };
});

export const removeFace = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("employees.manage");
  const emp = await loadEmployee(str(form, "id"), actor.businessId);
  const faces = storedFaceIds(emp);
  if (faces.length) await faceProvider().remove(actor.businessId, faces);
  await db.employee.update({ where: { id: emp.id }, data: { faceId: null, faceIds: [], faceEnrolledAt: null } });
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
