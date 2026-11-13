"use server";

import { revalidatePath } from "next/cache";
import { assertStaff, issueOtp, verifyOtp } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { formatRs, parseRs } from "@/lib/money";
import { can, canSeeSite } from "@/lib/permissions";
import { employeeBalance, recoveredByAdvance } from "@/lib/services";
import { safe, str, type ActionResult } from "@/lib/action";
import { dateKeyToDb, dbToDateKey, isMonthKey, istDateKey } from "@/lib/time";

export const giveAdvance = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("advances.manage");
  const emp = await db.employee.findFirst({ where: { id: str(form, "employeeId"), businessId: actor.businessId } });
  if (!emp || !canSeeSite(actor, emp.siteId)) return { error: "Employee not found" };
  if (!emp.active) return { error: "This employee is archived" };
  const amount = parseRs(str(form, "amount"));
  if (amount == null || amount <= 0) return { error: "Enter the amount" };
  const givenOn = str(form, "givenOn") || istDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(givenOn) || givenOn > istDateKey(new Date())) return { error: "Enter a valid date (not in the future)" };
  const recoveryMonths = Number(str(form, "recoveryMonths") || "1");
  if (!Number.isInteger(recoveryMonths) || recoveryMonths < 1 || recoveryMonths > 24) return { error: "Recovery months must be 1 to 24" };
  const startMonth = str(form, "startMonth") || givenOn.slice(0, 7);
  if (!isMonthKey(startMonth)) return { error: "Choose the first recovery month" };
  const run = await db.payrollRun.findUnique({ where: { businessId_month: { businessId: actor.businessId, month: startMonth } } });
  if (run?.status === "LOCKED") return { error: `Salary for ${startMonth} is already locked. Start recovery from a later month.` };

  const { balance } = await employeeBalance(emp);
  const goesNegative = amount > balance;
  const selfApprove = can(actor, "approvals.decide");
  const needsApproval = goesNegative && !selfApprove;
  const note = str(form, "note") || null;

  const advance = await db.$transaction(async (tx) => {
    const a = await tx.advance.create({
      data: {
        businessId: actor.businessId,
        employeeId: emp.id,
        amount,
        givenOn: dateKeyToDb(givenOn),
        recoveryMonths,
        startMonth,
        note,
        status: needsApproval ? "PENDING_APPROVAL" : "ACTIVE",
        createdBy: actor.id,
        approvedBy: goesNegative && selfApprove ? actor.id : null,
      },
    });
    if (needsApproval) {
      await tx.approvalRequest.create({
        data: {
          businessId: actor.businessId,
          kind: "advance",
          refId: a.id,
          requestedBy: actor.id,
          summary: `Advance ${formatRs(amount)} to ${emp.name} (${emp.code}). Balance after: ${formatRs(balance - amount)}`,
        },
      });
    }
    return a;
  });
  await audit(actor.businessId, actor.id, "advance.create", "Advance", advance.id, { employeeId: emp.id, amount, recoveryMonths, startMonth, goesNegative });
  revalidatePath("/employees", "layout");
  revalidatePath("/advances");
  if (needsApproval) {
    return { ok: true, message: "Balance will go negative. Sent for owner approval (see Approvals).", data: { pending: advance.id } };
  }
  return { ok: true, message: goesNegative ? "Advance saved (approved by you, balance negative)" : "Advance saved" };
});

async function decide(approvalId: string, businessId: string, deciderId: string, approve: boolean) {
  await db.$transaction(async (tx) => {
    const req = await tx.approvalRequest.findFirst({ where: { id: approvalId, businessId, status: "PENDING" } });
    if (!req) throw new Error("Request not found or already decided");
    await tx.approvalRequest.update({
      where: { id: req.id },
      data: { status: approve ? "APPROVED" : "REJECTED", decidedBy: deciderId, decidedAt: new Date() },
    });
    if (req.kind === "advance") {
      await tx.advance.update({
        where: { id: req.refId },
        data: approve ? { status: "ACTIVE", approvedBy: deciderId } : { status: "REJECTED" },
      });
    }
    await audit(businessId, deciderId, approve ? "approval.approve" : "approval.reject", "ApprovalRequest", req.id, undefined, tx);
  });
  revalidatePath("/approvals");
  revalidatePath("/advances");
  revalidatePath("/employees", "layout");
}

/** Owner (or a manager with approval permission) approves inside the app. */
export const decideApproval = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("approvals.decide");
  const approve = str(form, "decision") === "approve";
  await decide(str(form, "approvalId"), actor.businessId, actor.id, approve);
  return { ok: true, message: approve ? "Approved" : "Rejected" };
});

async function approverPhone(businessId: string) {
  const owner = await db.user.findFirst({ where: { businessId, role: "OWNER", active: true }, orderBy: { createdAt: "asc" } });
  if (!owner) throw new Error("No owner account found");
  return owner;
}

/** Backup path: an OTP goes to the owner's mobile; the owner tells the manager the code. */
export const sendApprovalOtp = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff();
  const req = await db.approvalRequest.findFirst({ where: { id: str(form, "approvalId"), businessId: actor.businessId, status: "PENDING" } });
  if (!req) return { error: "Request not found or already decided" };
  const owner = await approverPhone(actor.businessId);
  const r = await issueOtp(owner.phone, `approval:${req.id}`);
  if (!r.ok) return { error: r.error };
  return {
    ok: true,
    message: `OTP sent to owner's mobile ending ${owner.phone.slice(-4)}${r.devCode ? ` (test code: ${r.devCode})` : ""}`,
  };
});

export const verifyApprovalOtp = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff();
  const approvalId = str(form, "approvalId");
  const code = str(form, "code");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6 digit OTP" };
  const owner = await approverPhone(actor.businessId);
  if (!(await verifyOtp(owner.phone, `approval:${approvalId}`, code))) return { error: "Wrong or expired OTP" };
  await decide(approvalId, actor.businessId, owner.id, true);
  await audit(actor.businessId, actor.id, "approval.otp", "ApprovalRequest", approvalId, { enteredBy: actor.id });
  return { ok: true, message: "Approved by owner OTP" };
});

/**
 * Owner only: correct an advance (amount, date, recovery plan, note) or cancel it.
 * Money already recovered in locked salary months cannot be undone, so the amount can't go below it
 * and the start month is fixed once recovery has begun. Draft salary changes after "Recalculate".
 */
export const editAdvance = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff();
  if (actor.role !== "OWNER") return { error: "Only the owner can change an advance" };
  const adv = await db.advance.findFirst({ where: { id: str(form, "advanceId"), businessId: actor.businessId }, include: { employee: true } });
  if (!adv) return { error: "Advance not found" };
  if (adv.status !== "ACTIVE" && adv.status !== "CLEARED") return { error: "Only active or cleared advances can be changed" };
  const recovered = (await recoveredByAdvance([adv.id])).get(adv.id) ?? 0;

  if (str(form, "cancel") === "1") {
    if (recovered > 0) return { error: `${formatRs(recovered)} is already recovered in locked salary. Reduce the amount instead.` };
    await db.advance.update({ where: { id: adv.id }, data: { status: "CANCELLED" } });
    await audit(actor.businessId, actor.id, "advance.cancel", "Advance", adv.id, { amount: adv.amount, employeeId: adv.employeeId });
    revalidatePath("/employees", "layout");
    revalidatePath("/advances");
    return { ok: true, message: "Advance cancelled. Recalculate draft salary to update it." };
  }

  const amount = parseRs(str(form, "amount"));
  if (amount == null || amount <= 0) return { error: "Enter the amount" };
  if (amount < recovered) return { error: `Amount cannot be less than ${formatRs(recovered)} already recovered` };
  const givenOn = str(form, "givenOn") || dbToDateKey(adv.givenOn);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(givenOn) || givenOn > istDateKey(new Date())) return { error: "Enter a valid date (not in the future)" };
  const recoveryMonths = Number(str(form, "recoveryMonths") || String(adv.recoveryMonths));
  if (!Number.isInteger(recoveryMonths) || recoveryMonths < 1 || recoveryMonths > 24) return { error: "Recovery months must be 1 to 24" };
  const startMonth = str(form, "startMonth") || adv.startMonth;
  if (!isMonthKey(startMonth)) return { error: "Choose the first recovery month" };
  if (startMonth !== adv.startMonth) {
    if (recovered > 0) return { error: "Recovery has already started, so the start month cannot change" };
    const run = await db.payrollRun.findUnique({ where: { businessId_month: { businessId: actor.businessId, month: startMonth } } });
    if (run?.status === "LOCKED") return { error: `Salary for ${startMonth} is already locked. Choose a later month.` };
  }
  const note = form.has("note") ? str(form, "note") || null : adv.note;

  await db.advance.update({
    where: { id: adv.id },
    data: { amount, givenOn: dateKeyToDb(givenOn), recoveryMonths, startMonth, note, status: recovered >= amount ? "CLEARED" : "ACTIVE" },
  });
  await audit(actor.businessId, actor.id, "advance.edit", "Advance", adv.id, {
    before: { amount: adv.amount, givenOn: dbToDateKey(adv.givenOn), recoveryMonths: adv.recoveryMonths, startMonth: adv.startMonth },
    after: { amount, givenOn, recoveryMonths, startMonth },
  });
  revalidatePath("/employees", "layout");
  revalidatePath("/advances");
  return { ok: true, message: "Advance updated. Recalculate draft salary to apply it." };
});
