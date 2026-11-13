"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { canSeeSite } from "@/lib/permissions";
import { safe, str, type ActionResult } from "@/lib/action";
import { dateKeyToDb, dbToDateKey, istDateKey } from "@/lib/time";

// Leave scheduled ahead. Days in the plan count as leave unless the person comes back (scan or
// manual attendance ends the plan the day before) or a manager sets a day by hand.

const DAY = 86400000;
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const prevDay = (d: string) => dbToDateKey(new Date(dateKeyToDb(d).getTime() - DAY));

/** First locked salary month touched by a date range, if any. */
async function lockedMonthIn(businessId: string, from: string, to: string) {
  const run = await db.payrollRun.findFirst({ where: { businessId, status: "LOCKED", month: { gte: from.slice(0, 7), lte: to.slice(0, 7) } }, orderBy: { month: "asc" } });
  return run?.month ?? null;
}

async function loadPlan(id: string, businessId: string) {
  const plan = await db.leavePlan.findFirst({ where: { id, businessId }, include: { employee: true } });
  if (!plan) throw new Error("Leave not found");
  return plan;
}

export const scheduleLeave = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("attendance.edit");
  const emp = await db.employee.findFirst({ where: { id: str(form, "employeeId"), businessId: actor.businessId } });
  if (!emp || !canSeeSite(actor, emp.siteId)) return { error: "Choose an employee" };
  if (!emp.active) return { error: "This employee is archived" };
  const from = str(form, "fromDate");
  const to = str(form, "toDate");
  if (!isDate(from) || !isDate(to)) return { error: "Choose the first and last day of the leave" };
  if (to < from) return { error: "The last day must be on or after the first day" };
  if ((dateKeyToDb(to).getTime() - dateKeyToDb(from).getTime()) / DAY > 366) return { error: "A leave can be at most one year" };
  if (from < dbToDateKey(emp.joinedOn)) return { error: "The leave starts before the joining date" };
  const locked = await lockedMonthIn(actor.businessId, from, to);
  if (locked) return { error: `Salary for ${locked} is already locked. Choose dates after it.` };
  const overlap = await db.leavePlan.findFirst({ where: { employeeId: emp.id, status: "ACTIVE", fromDate: { lte: dateKeyToDb(to) }, toDate: { gte: dateKeyToDb(from) } } });
  if (overlap) return { error: `Overlaps a leave from ${dbToDateKey(overlap.fromDate)} to ${dbToDateKey(overlap.toDate)}` };
  const paid = str(form, "paid") !== "0";
  const reason = str(form, "reason") || null;
  const plan = await db.leavePlan.create({
    data: { businessId: actor.businessId, employeeId: emp.id, fromDate: dateKeyToDb(from), toDate: dateKeyToDb(to), paid, reason, createdBy: actor.id },
  });
  await audit(actor.businessId, actor.id, "leave.schedule", "LeavePlan", plan.id, { employeeId: emp.id, from, to, paid, reason });
  revalidatePath("/", "layout");
  return { ok: true, message: `${paid ? "Paid" : "Unpaid"} leave scheduled for ${emp.name}`, data: { id: plan.id } };
});

/** Came back early: the leave ends the day before the return date. */
export const endLeave = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("attendance.edit");
  const plan = await loadPlan(str(form, "leaveId"), actor.businessId);
  if (!canSeeSite(actor, plan.employee.siteId)) return { error: "Not allowed for this site" };
  if (plan.status !== "ACTIVE") return { error: "This leave is cancelled" };
  const back = str(form, "returnDate") || istDateKey(new Date());
  if (!isDate(back)) return { error: "Choose the day they came back" };
  const from = dbToDateKey(plan.fromDate);
  const to = dbToDateKey(plan.toDate);
  if (back > to) return { error: "That day is after the leave ends anyway" };
  const locked = await lockedMonthIn(actor.businessId, back, to);
  if (locked) return { error: `Salary for ${locked} is already locked` };
  if (back <= from) {
    await db.leavePlan.update({ where: { id: plan.id }, data: { status: "CANCELLED", plannedTo: plan.toDate } });
  } else {
    await db.leavePlan.update({ where: { id: plan.id }, data: { toDate: dateKeyToDb(prevDay(back)), plannedTo: plan.plannedTo ?? plan.toDate } });
  }
  await audit(actor.businessId, actor.id, "leave.end", "LeavePlan", plan.id, { employeeId: plan.employeeId, from, plannedTo: to, back });
  revalidatePath("/", "layout");
  return { ok: true, message: `Leave ended. ${plan.employee.name} is back from ${back}.` };
});

export const cancelLeave = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("attendance.edit");
  const plan = await loadPlan(str(form, "leaveId"), actor.businessId);
  if (!canSeeSite(actor, plan.employee.siteId)) return { error: "Not allowed for this site" };
  if (plan.status !== "ACTIVE") return { error: "Already cancelled" };
  const locked = await lockedMonthIn(actor.businessId, dbToDateKey(plan.fromDate), dbToDateKey(plan.toDate));
  if (locked) return { error: `Salary for ${locked} is already locked. Use "End leave" instead.` };
  await db.leavePlan.update({ where: { id: plan.id }, data: { status: "CANCELLED" } });
  await audit(actor.businessId, actor.id, "leave.cancel", "LeavePlan", plan.id, { employeeId: plan.employeeId, from: dbToDateKey(plan.fromDate), to: dbToDateKey(plan.toDate) });
  revalidatePath("/", "layout");
  return { ok: true, message: "Leave cancelled" };
});
