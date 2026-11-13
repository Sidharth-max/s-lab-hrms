import { db } from "@/lib/db";
import { json, staff } from "@/lib/api";

export async function GET() {
  return staff(async (actor) => {
    const devices = await db.device.findMany({ where: { businessId: actor.businessId }, include: { site: true }, orderBy: { createdAt: "desc" } });
    const users = new Map((await db.user.findMany({ where: { id: { in: devices.map((d) => d.registeredBy) } } })).map((u) => [u.id, u.name]));
    return json({
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        site: d.site.name,
        registeredBy: users.get(d.registeredBy) ?? "?",
        createdAt: d.createdAt.toISOString(),
        lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        revoked: !!d.revokedAt,
      })),
    });
  }, "devices.register");
}
