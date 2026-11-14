"use server";

import { revalidatePath } from "next/cache";
import { assertStaff, issueOtp, verifyOtp } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { formatRs, parseRs } from "@/lib/money";
import { can, canSeeSite } from "@/lib/permissions";
import { hisaabOf } from "@/lib/ledger";
import { safe, str, type ActionResult } from "@/lib/action";
import { noteOrNull } from "@/lib/text";
import { dateKeyToDb, dbToDateKey, istDateKey } from "@/lib/time";

export const giveAdvance = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff("advances.manage");
  const emp = await db.employee.findFirst({ where: { id: str(form, "employeeId"), businessId: actor.businessId } });
  if (!emp || !canSeeSite(actor, emp.siteId)) return { error: "Employee not found" };
  if (!emp.active) return { error: "This employee is archived" };
  const amount = parseRs(str(form, "amount"));
  if (amount == null || amount <= 0) return { error: "Enter the amount" };
  const givenOn = str(form, "givenOn") || istDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(givenOn) || givenOn > istDateKey(new Date())) return { error: "Enter a valid date (not in the future)" };

  // The advance comes straight off the employee's running balance.
  const { balance } = await hisaabOf(emp);
  const goesNegative = amount > balance;
  const selfApprove = can(actor, "approvals.decide");
  const needsApproval = goesNegative && !selfApprove;
  const note = noteOrNull(str(form, "note"));

  const advance = await db.$transaction(async (tx) => {
    const a = await tx.advance.create({
      data: {
        businessId: actor.businessId,
        employeeId: emp.id,
        amount,
        givenOn: dateKeyToDb(givenOn),
        recoveryMonths: 1,
        startMonth: givenOn.slice(0, 7),
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
  await audit(actor.businessId, actor.id, "advance.create", "Advance", advance.id, { employeeId: emp.id, amount, givenOn, goesNegative });
  revalidatePath("/employees", "layout");
  revalidatePath("/advances");
  if (needsApproval) {
    return { ok: true, message: "Balance will go negative. Sent for approval (owner or an approving manager, see Approvals).", data: { pending: advance.id } };
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

/** Owner only: correct an advance (amount, date, note) or cancel it. The balance updates straight away. */
export const editAdvance = safe(async (_p: ActionResult, form: FormData): Promise<ActionResult> => {
  const actor = await assertStaff();
  if (actor.role !== "OWNER") return { error: "Only the owner can change an advance" };
  const adv = await db.advance.findFirst({ where: { id: str(form, "advanceId"), businessId: actor.businessId }, include: { employee: true } });
  if (!adv) return { error: "Advance not found" };
  if (adv.status !== "ACTIVE" && adv.status !== "CLEARED") return { error: "Only given advances can be changed" };

  if (str(form, "cancel") === "1") {
    await db.advance.update({ where: { id: adv.id }, data: { status: "CANCELLED" } });
    await audit(actor.businessId, actor.id, "advance.cancel", "Advance", adv.id, { amount: adv.amount, employeeId: adv.employeeId });
    revalidatePath("/", "layout");
    return { ok: true, message: "Advance cancelled. It no longer counts in the balance." };
  }

  const amount = parseRs(str(form, "amount"));
  if (amount == null || amount <= 0) return { error: "Enter the amount" };
  const givenOn = str(form, "givenOn") || dbToDateKey(adv.givenOn);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(givenOn) || givenOn > istDateKey(new Date())) return { error: "Enter a valid date (not in the future)" };
  const note = form.has("note") ? noteOrNull(str(form, "note")) : adv.note;

  await db.advance.update({ where: { id: adv.id }, data: { amount, givenOn: dateKeyToDb(givenOn), startMonth: givenOn.slice(0, 7), note, status: "ACTIVE" } });
  await audit(actor.businessId, actor.id, "advance.edit", "Advance", adv.id, {
    before: { amount: adv.amount, givenOn: dbToDateKey(adv.givenOn) },
    after: { amount, givenOn },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Advance updated" };
});
