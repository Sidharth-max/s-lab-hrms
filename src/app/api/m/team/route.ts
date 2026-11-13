import { db } from "@/lib/db";
import { apiError, json, staff } from "@/lib/api";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  return staff(async (actor) => {
    if (actor.role !== "OWNER") return apiError("Only the owner can manage managers", 403);
    const [managers, owners, sites] = await Promise.all([
      db.user.findMany({ where: { businessId: actor.businessId, role: "MANAGER" }, orderBy: { name: "asc" } }),
      db.user.findMany({ where: { businessId: actor.businessId, role: "OWNER" } }),
      db.site.findMany({ where: { businessId: actor.businessId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    return json({
      owners: owners.map((o) => ({ name: o.name, phone: o.phone })),
      managers: managers.map((m) => ({ id: m.id, name: m.name, phone: m.phone, active: m.active, permissions: m.permissions, siteIds: m.siteIds })),
      permissions: ALL_PERMISSIONS.map((p) => ({ key: p, label: PERMISSIONS[p] })),
      groups: PERMISSION_GROUPS.map((g) => ({ title: g.title, items: g.keys.map((k) => ({ key: k, label: PERMISSIONS[k] })) })),
      sites,
    });
  });
}
