"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { endLeaveOnReturn } from "@/lib/leave-return";
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
  if (type === "IN") await endLeaveOnReturn(actor.businessId, emp.id, date, actor.id);
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

/**
 * Mark a day by hand with an IN and / or OUT time (default: the store's opening and closing time
 * for that weekday, i.e. a full day). Each given time becomes a manual punch, like a scan.
 */
export const markAttendance = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("attendance.edit");
  const date = str(form, "date");
  // The website form has "no in / out time" boxes; the app simply sends an empty time.
  const inTime = form.get("skipIn") === "on" ? "" : str(form, "inTime");
  const outTime = form.get("skipOut") === "on" ? "" : str(form, "outTime");
  const reason = str(form, "reason") || "Marked by hand";
  if (!inTime && !outTime) return { error: "Choose an in time or an out time" };
  for (const t of [inTime, outTime]) if (t && !/^\d{2}:\d{2}$/.test(t)) return { error: "Choose a valid time" };
  const emp = await checkEditable(actor.businessId, str(form, "employeeId"), date, actor);
  const outNextDay = form.get("nextDay") === "on";
  const inAt = inTime ? istDateTime(date, inTime) : null;
  const outAt = outTime ? istDateTime(outNextDay ? istDateKey(new Date(dateKeyToDb(date).getTime() + 86400000)) : date, outTime) : null;
  if (inAt && outAt && outAt <= inAt) return { error: "Out time must be after the in time (or turn on 'after midnight')" };
  // Today's closing time may still be ahead: allowed, it is the manager's decision. Later days are not.
  const endOfToday = istDateTime(istDateKey(new Date()), "23:59");
  if ((inAt && inAt > endOfToday) || (outAt && outAt > new Date(endOfToday.getTime() + 86400000))) return { error: "That time is in the future" };
  const rows = [
    ...(inAt ? [{ type: "IN" as const, at: inAt }] : []),
    ...(outAt ? [{ type: "OUT" as const, at: outAt }] : []),
  ];
  await db.attendancePunch.createMany({
    data: rows.map((r) => ({ businessId: actor.businessId, employeeId: emp.id, type: r.type, at: r.at, workDate: dateKeyToDb(date), source: "MANUAL" as const, reason, createdBy: actor.id })),
  });
  if (inAt) await endLeaveOnReturn(actor.businessId, emp.id, date, actor.id);
  // A status set by hand earlier (absent, leave…) would hide these times: put the day back on automatic.
  const last = await db.dayOverride.findFirst({ where: { employeeId: emp.id, workDate: dateKeyToDb(date) }, orderBy: { createdAt: "desc" } });
  if (inAt && last && last.status !== "AUTO" && last.status !== "PRESENT") {
    await db.dayOverride.create({ data: { employeeId: emp.id, workDate: dateKeyToDb(date), status: "AUTO", reason: "Attendance marked by hand", createdBy: actor.id } });
  }
  for (const r of rows) {
    await audit(actor.businessId, actor.id, "attendance.punch.add", "AttendancePunch", null, { employeeId: emp.id, date, type: r.type, time: r.type === "IN" ? inTime : outTime, reason });
  }
  revalidatePath("/attendance", "layout");
  return { ok: true, message: inAt && outAt ? `Marked present ${inTime} to ${outTime}` : inAt ? `In time ${inTime} added` : `Out time ${outTime} added` };
});
