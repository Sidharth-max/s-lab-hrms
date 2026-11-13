"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { formatRs, parseRs } from "@/lib/money";
import { canSeeSite } from "@/lib/permissions";
import { lockPayroll, recalculatePayroll, reopenPayroll, salaryDue } from "@/lib/services";
import { safe, str, type ActionResult } from "@/lib/action";
import { dateKeyToDb, isMonthKey, istDateKey, istMonthKey } from "@/lib/time";

const TX = { timeout: 60000, maxWait: 10000 };

function month(form: FormData) {
  const m = str(form, "month");
  if (!isMonthKey(m)) throw new Error("Bad month");
  if (m > istMonthKey(new Date())) throw new Error("Cannot prepare salary for a future month");
  return m;
}

export const recalcPayroll = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("payroll.run");
  const m = month(form);
  await db.$transaction((tx) => recalculatePayroll(actor.businessId, m, tx), TX);
  await audit(actor.businessId, actor.id, "payroll.recalculate", "PayrollRun", null, { month: m });
  revalidatePath(`/payroll/${m}`);
  return { ok: true, message: "Salary calculated from latest attendance" };
});

export const lockPayrollAction = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("payroll.lock");
  const m = month(form);
  await db.$transaction((tx) => lockPayroll(actor.businessId, m, actor.id, tx), TX);
  await audit(actor.businessId, actor.id, "payroll.lock", "PayrollRun", null, { month: m });
  revalidatePath(`/payroll/${m}`);
  return { ok: true, message: "Salary locked. Attendance for this month can no longer be edited." };
});

export const reopenPayrollAction = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff();
  if (actor.role !== "OWNER") return { error: "Only the owner can reopen a locked month" };
  const m = month(form);
  await db.$transaction((tx) => reopenPayroll(actor.businessId, m, tx), TX);
  await audit(actor.businessId, actor.id, "payroll.reopen", "PayrollRun", null, { month: m });
  revalidatePath(`/payroll/${m}`);
  return { ok: true, message: "Month reopened" };
});

export const addAdjustment = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("payroll.run");
  const m = month(form);
  const emp = await db.employee.findFirst({ where: { id: str(form, "employeeId"), businessId: actor.businessId } });
  if (!emp || !canSeeSite(actor, emp.siteId)) return { error: "Choose an employee" };
  const amount = parseRs(str(form, "amount"));
  if (amount == null || amount === 0) return { error: "Enter the amount" };
  const reason = str(form, "reason");
  if (reason.length < 3) return { error: "Write a reason" };
  const run = await db.payrollRun.findUnique({ where: { businessId_month: { businessId: actor.businessId, month: m } } });
  if (run?.status === "LOCKED") return { error: "This month is locked. Add it to next month." };
  const signed = str(form, "kind") === "deduct" ? -amount : amount;
  const a = await db.adjustment.create({ data: { employeeId: emp.id, month: m, amount: signed, reason, createdBy: actor.id } });
  await audit(actor.businessId, actor.id, "payroll.adjustment", "Adjustment", a.id, { employeeId: emp.id, month: m, amount: signed, reason });
  if (run) await db.$transaction((tx) => recalculatePayroll(actor.businessId, m, tx), TX);
  revalidatePath(`/payroll/${m}`);
  return { ok: true, message: "Adjustment added and salary recalculated" };
});

export const recordPayment = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("payroll.lock");
  const line = await db.payrollLine.findFirst({
    where: { id: str(form, "lineId"), run: { businessId: actor.businessId } },
    include: { run: true },
  });
  if (!line) return { error: "Salary line not found" };
  if (line.run.status !== "LOCKED") return { error: "Lock the month before recording payments" };
  const amount = parseRs(str(form, "amount"));
  if (amount == null || amount < 0) return { error: "Enter the amount paid" };
  const paidOn = str(form, "paidOn") || istDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { error: "Enter the payment date" };
  const mode = ["CASH", "BANK", "UPI", "CHEQUE"].includes(str(form, "mode")) ? str(form, "mode") : "CASH";
  await db.payrollLine.update({
    where: { id: line.id },
    data: { paidAmount: amount, paidOn: dateKeyToDb(paidOn), paymentMode: mode, paymentRef: str(form, "ref") || null },
  });
  await audit(actor.businessId, actor.id, "payroll.payment", "PayrollLine", line.id, {
    before: line.paidAmount,
    after: amount,
    mode,
  });
  revalidatePath(`/payroll/${line.run.month}`);
  return { ok: true, message: "Payment saved" };
});

/** Pays everything that is due to one employee across locked months in one go (held salary, or months paid late). */
export const payAllDue = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("payroll.lock");
  const emp = await db.employee.findFirst({ where: { id: str(form, "employeeId"), businessId: actor.businessId } });
  if (!emp) return { error: "Employee not found" };
  const paidOn = str(form, "paidOn") || istDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { error: "Enter the payment date" };
  const mode = ["CASH", "BANK", "UPI", "CHEQUE"].includes(str(form, "mode")) ? str(form, "mode") : "CASH";
  const ref = str(form, "ref") || null;
  const due = await salaryDue(emp.id);
  if (due.months.length === 0) return { error: "Nothing is due. Only approved and locked months can be paid." };
  await db.$transaction(due.months.map((m) => db.payrollLine.update({ where: { id: m.lineId }, data: { paidAmount: m.net, paidOn: dateKeyToDb(paidOn), paymentMode: mode, paymentRef: ref } })));
  await audit(actor.businessId, actor.id, "payroll.payall", "Employee", emp.id, { total: due.total, months: due.months.map((m) => m.month), mode });
  revalidatePath("/", "layout");
  return { ok: true, message: `Paid ${formatRs(due.total)} for ${due.months.length} month${due.months.length === 1 ? "" : "s"}` };
});
