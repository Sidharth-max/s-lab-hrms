import { db } from "@/lib/db";
import { json, staff } from "@/lib/api";
import { ALL_PERMISSIONS, can } from "@/lib/permissions";
import { siteWhere } from "@/lib/scope";

// Who is signed in, what they may do, and the sites they can see.
export async function GET() {
  return staff(async (actor) => {
    const [business, sites, pendingApprovals] = await Promise.all([
      db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
      db.site.findMany({ where: { ...siteWhere(actor), active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.approvalRequest.count({ where: { businessId: actor.businessId, status: "PENDING" } }),
    ]);
    return json({
      user: { id: actor.id, name: actor.name, phone: actor.phone, role: actor.role },
      business: { id: business.id, name: business.name },
      permissions: ALL_PERMISSIONS.filter((p) => can(actor, p)),
      sites,
      pendingApprovals,
    });
  });
}
