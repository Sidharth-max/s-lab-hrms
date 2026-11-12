import type { Prisma } from "@prisma/client";
import { siteScope, type Actor } from "./permissions";

/** Employees the actor may see (site-limited managers see only their sites). */
export function employeeScope(actor: Actor, extra: Prisma.EmployeeWhereInput = {}): Prisma.EmployeeWhereInput {
  const sites = siteScope(actor);
  return { businessId: actor.businessId, ...(sites ? { siteId: { in: sites } } : {}), ...extra };
}

export function siteWhere(actor: Actor): Prisma.SiteWhereInput {
  const sites = siteScope(actor);
  return { businessId: actor.businessId, ...(sites ? { id: { in: sites } } : {}) };
}
