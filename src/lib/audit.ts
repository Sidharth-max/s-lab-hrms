import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { kindOf, publish } from "./events";

export async function audit(
  businessId: string,
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  detail?: Prisma.InputJsonValue,
  tx: Prisma.TransactionClient = db,
) {
  await tx.auditLog.create({ data: { businessId, actorId, action, entity, entityId, detail } });
  // Every recorded change also tells open screens to refresh.
  publish(businessId, kindOf(action));
}
