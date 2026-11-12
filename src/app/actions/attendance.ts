"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { canSeeSite } from "@/lib/permissions";
import { safe, str, type ActionResult } from "@/lib/action";
import { addMonths, dateKeyToDb, istDateKey, istDateTime } from "@/lib/time";

const STATUSES = ["PRESENT", "HALF_DAY", "ABSENT", "PAID_LEAVE", "UNPAID_LEAVE"] as const;

async function checkEditable(businessId: string, employeeId: string, date: string, actor: Awaited<ReturnType<typeof assertStaff>>) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Bad date");
  if (date > istDateKey(new Date())) throw new Error("Cannot edit a future date");
  const emp = await db.employee.findFirst({ where: { id: employeeId, businessId } });
  if (!emp || !canSeeSite(actor, emp.siteId)) throw new Error("Employee not found");
  const run = await db.payrollRun.findUnique({ where: { businessId_month: { businessId, month: date.slice(0, 7) } } });
  if (run?.status === "LOCKED") {
    throw new Error(`Salary for ${date.slice(0, 7)} is locked. Add an adjustment in ${addMonths(date.slice(0, 7), 1)} instead, or ask the owner to reopen it.`);
  }
  return emp;
}

export const setDayStatus = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("attendance.edit");
  const date = str(form, "date");
  const status = str(form, "status") as (typeof STATUSES)[number];
  const reason = str(form, "reason");
  if (!STATUSES.includes(status)) return { error: "Choose a status" };
  if (reason.length < 3) return { error: "Write a reason" };
  const emp = await checkEditable(actor.businessId, str(form, "employeeId"), date, actor);
  const o = await db.dayOverride.create({
    data: { employeeId: emp.id, workDate: dateKeyToDb(date), status, reason, createdBy: actor.id },
  });
  await audit(actor.businessId, actor.id, "attendance.override", "DayOverride", o.id, { employeeId: emp.id, date, status, reason });
  revalidatePath("/attendance", "layout");
  return { ok: true, message: "Saved" };
});

export const clearDayStatus = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("attendance.edit");
  const date = str(form, "date");
  const emp = await checkEditable(actor.businessId, str(form, "employeeId"), date, actor);
  // Nothing is deleted: an AUTO row on top means "use the scans again"; older rows stay as history.
  const o = await db.dayOverride.create({
    data: { employeeId: emp.id, workDate: dateKeyToDb(date), status: "AUTO", reason: str(form, "reason") || "Back to automatic", createdBy: actor.id },
  });
  await audit(actor.businessId, actor.id, "attendance.override.clear", "DayOverride", o.id, { employeeId: emp.id, date });
  revalidatePath("/attendance", "layout");
  return { ok: true, message: "Back to automatic (from scans)" };
});

export const addManualPunch = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("attendance.edit");
  const date = str(form, "date");
  const type = str(form, "type") === "OUT" ? "OUT" : "IN";
  const time = str(form, "time");
  const reason = str(form, "reason");
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: "Enter the time" };
  if (reason.length < 3) return { error: "Write a reason" };
  const emp = await checkEditable(actor.businessId, str(form, "employeeId"), date, actor);
  const nextDay = form.get("nextDay") === "on";
  const at = istDateTime(nextDay ? istDateKey(new Date(dateKeyToDb(date).getTime() + 86400000)) : date, time);
  if (at > new Date()) return { error: "Time is in the future" };
  const p = await db.attendancePunch.create({
    data: { businessId: actor.businessId, employeeId: emp.id, type, at, workDate: dateKeyToDb(date), source: "MANUAL", reason, createdBy: actor.id },
  });
  await audit(actor.businessId, actor.id, "attendance.punch.add", "AttendancePunch", p.id, { employeeId: emp.id, date, type, time, reason });
  revalidatePath("/attendance", "layout");
  return { ok: true, message: "Punch added" };
});

export const voidPunch = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("attendance.edit");
  const punch = await db.attendancePunch.findFirst({ where: { id: str(form, "punchId"), businessId: actor.businessId, voidedAt: null } });
  if (!punch) return { error: "Punch not found" };
  const reason = str(form, "reason") || "Removed by manager";
  await checkEditable(actor.businessId, punch.employeeId, punch.workDate.toISOString().slice(0, 10), actor);
  await db.attendancePunch.update({ where: { id: punch.id }, data: { voidedAt: new Date(), voidedBy: actor.id, voidReason: reason } });
  await audit(actor.businessId, actor.id, "attendance.punch.void", "AttendancePunch", punch.id, { reason });
  revalidatePath("/attendance", "layout");
  return { ok: true, message: "Punch removed (kept in history)" };
});
