import { db } from "@/lib/db";
import { apiError, json, staff } from "@/lib/api";
import { describeHistory } from "@/lib/audit-text";

// History for the app, written as plain sentences (owner only).
export async function GET() {
  return staff(async (actor) => {
    if (actor.role !== "OWNER") return apiError("Only the owner can see the history", 403);
    const logs = await db.auditLog.findMany({ where: { businessId: actor.businessId }, orderBy: { createdAt: "desc" }, take: 200 });
    return json({ items: await describeHistory(actor.businessId, logs) });
  });
}
