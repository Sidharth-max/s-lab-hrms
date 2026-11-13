"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { formatRs, parseRs } from "@/lib/money";
import { canSeeSite } from "@/lib/permissions";
import { safe, str, type ActionResult } from "@/lib/action";
import { dateKeyToDb, dbToDateKey, istDateKey } from "@/lib/time";

// Salary is one running balance per employee (see lib/ledger.ts). These actions add money
// movements to it. Nothing is locked: attendance and entries can be corrected any time.

const MODES = ["CASH", "BANK", "UPI", "CHEQUE"];
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

async function employeeFor(actor: Awaited<ReturnType<typeof assertStaff>>, id: string) {
  const emp = await db.employee.findFirst({ where: { id, businessId: actor.businessId } });
  if (!emp || !canSeeSite(actor, emp.siteId)) throw new Error("Employee not found");
  return emp;
}

function done() {
  revalidatePath("/", "layout");
}

/** Money handed to the employee. Paying the full balance clears their hisaab. */
export const paySalary = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("payroll.lock");
  const emp = await employeeFor(actor, str(form, "employeeId"));
  const amount = parseRs(str(form, "amount"));
  if (amount == null || amount <= 0) return { error: "Enter the amount paid" };
  const paidOn = str(form, "paidOn") || istDateKey(new Date());
  if (!isDate(paidOn) || paidOn > istDateKey(new Date())) return { error: "Enter the payment date (not in the future)" };
  const mode = MODES.includes(str(form, "mode")) ? str(form, "mode") : "CASH";
  const p = await db.salaryPayment.create({
    data: {
      businessId: actor.businessId,
      employeeId: emp.id,
      amount,
      paidOn: dateKeyToDb(paidOn),
      mode,
      ref: str(form, "ref") || null,
      note: str(form, "note") || null,
      createdBy: actor.id,
    },
  });
  await audit(actor.businessId, actor.id, "salary.pay", "SalaryPayment", p.id, { employeeId: emp.id, amount, paidOn, mode, cleared: str(form, "clear") === "1" });
  done();
  return { ok: true, message: `Paid ${formatRs(amount)} to ${emp.name}` };
});

/** Owner only: remove a payment entered by mistake. */
export const voidPayment = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff();
  if (actor.role !== "OWNER") return { error: "Only the owner can remove a payment" };
  const p = await db.salaryPayment.findFirst({ where: { id: str(form, "paymentId"), businessId: actor.businessId, voidedAt: null } });
  if (!p) return { error: "Payment not found" };
  await db.salaryPayment.update({ where: { id: p.id }, data: { voidedAt: new Date(), voidedBy: actor.id } });
  await audit(actor.businessId, actor.id, "salary.void", "SalaryPayment", p.id, { employeeId: p.employeeId, amount: p.amount, paidOn: dbToDateKey(p.paidOn) });
  done();
  return { ok: true, message: "Payment removed" };
});

/** Extra pay (bonus, overtime) or a deduction (damage, fine). */
export const addAdjustment = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("payroll.run");
  const emp = await employeeFor(actor, str(form, "employeeId"));
  const amount = parseRs(str(form, "amount"));
  if (amount == null || amount <= 0) return { error: "Enter the amount" };
  const reason = str(form, "reason");
  if (reason.length < 3) return { error: "Write a reason" };
  const onDate = str(form, "date") || istDateKey(new Date());
  if (!isDate(onDate) || onDate > istDateKey(new Date())) return { error: "Enter a valid date (not in the future)" };
  const signed = str(form, "kind") === "deduct" ? -amount : amount;
  const a = await db.adjustment.create({ data: { employeeId: emp.id, onDate: dateKeyToDb(onDate), month: onDate.slice(0, 7), amount: signed, reason, createdBy: actor.id } });
  await audit(actor.businessId, actor.id, "salary.adjustment", "Adjustment", a.id, { employeeId: emp.id, date: onDate, amount: signed, reason });
  done();
  return { ok: true, message: signed > 0 ? "Extra pay added" : "Deduction added" };
});

/** Owner only: remove an extra pay or deduction entered by mistake. */
export const removeAdjustment = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff();
  if (actor.role !== "OWNER") return { error: "Only the owner can remove an entry" };
  const a = await db.adjustment.findFirst({ where: { id: str(form, "adjustmentId"), employee: { businessId: actor.businessId } } });
  if (!a) return { error: "Entry not found" };
  await db.adjustment.delete({ where: { id: a.id } });
  await audit(actor.businessId, actor.id, "salary.adjustment.remove", "Adjustment", a.id, { employeeId: a.employeeId, amount: a.amount, reason: a.reason });
  done();
  return { ok: true, message: "Entry removed" };
});
