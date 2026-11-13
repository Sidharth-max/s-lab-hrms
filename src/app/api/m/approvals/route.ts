import { db } from "@/lib/db";
import { json, staff } from "@/lib/api";
import { can } from "@/lib/permissions";

export async function GET() {
  return staff(async (actor) => {
    const pending = await db.approvalRequest.findMany({ where: { businessId: actor.businessId, status: "PENDING" }, orderBy: { createdAt: "asc" } });
    const users = new Map((await db.user.findMany({ where: { id: { in: pending.map((p) => p.requestedBy) } } })).map((u) => [u.id, u.name]));
    return json({
      canDecide: can(actor, "approvals.decide"),
      pending: pending.map((p) => ({ id: p.id, summary: p.summary, requestedBy: users.get(p.requestedBy) ?? null, at: p.createdAt.toISOString() })),
    });
  });
}
