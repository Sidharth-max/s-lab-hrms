import { db } from "@/lib/db";
import { apiError, json, staff } from "@/lib/api";

export async function GET() {
  return staff(async (actor) => {
    if (actor.role !== "OWNER") return apiError("Only the owner can see the history", 403);
    const [logs, users] = await Promise.all([
      db.auditLog.findMany({ where: { businessId: actor.businessId }, orderBy: { createdAt: "desc" }, take: 200 }),
      db.user.findMany({ where: { businessId: actor.businessId }, select: { id: true, name: true } }),
    ]);
    const names = new Map(users.map((u) => [u.id, u.name]));
    return json({
      logs: logs.map((l) => ({ id: l.id, at: l.createdAt.toISOString(), by: l.actorId ? names.get(l.actorId) ?? "?" : "System", action: l.action, detail: l.detail })),
    });
  });
}
