import "server-only";
import { audit } from "./audit";
import { db } from "./db";
import { dateKeyToDb, dbToDateKey } from "./time";

/**
 * The person came back during a scheduled leave (face scan or attendance marked by hand):
 * the leave ends the day before. Leaving from the first day cancels it.
 */
export async function endLeaveOnReturn(businessId: string, employeeId: string, date: string, actorId: string | null) {
  const day = dateKeyToDb(date);
  const plan = await db.leavePlan.findFirst({ where: { businessId, employeeId, status: "ACTIVE", fromDate: { lte: day }, toDate: { gte: day } } });
  if (!plan) return null;
  const from = dbToDateKey(plan.fromDate);
  const plannedTo = dbToDateKey(plan.toDate);
  if (date <= from) await db.leavePlan.update({ where: { id: plan.id }, data: { status: "CANCELLED", plannedTo: plan.toDate } });
  else await db.leavePlan.update({ where: { id: plan.id }, data: { toDate: new Date(day.getTime() - 86400000), plannedTo: plan.plannedTo ?? plan.toDate } });
  await audit(businessId, actorId, "leave.returned", "LeavePlan", plan.id, { employeeId, from, plannedTo, back: date });
  return plan.id;
}
