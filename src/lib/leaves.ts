import "server-only";
import { db } from "./db";
import { employeeScope } from "./scope";
import type { Actor } from "./permissions";
import { dateKeyToDb, dbToDateKey, istDateKey } from "./time";

export interface LeaveRow {
  id: string;
  employeeId: string;
  employee: string;
  code: string;
  from: string;
  to: string;
  days: number;
  paid: boolean;
  reason: string | null;
  status: "ACTIVE" | "CANCELLED";
  plannedTo: string | null; // set when they came back early
  state: "upcoming" | "on_leave" | "done" | "cancelled";
}

/** Leaves for the list screens: one employee, or everyone whose leave ends today or later (plus the last 60 days). */
export async function listLeaves(actor: Actor, opts: { employeeId?: string } = {}): Promise<LeaveRow[]> {
  const today = istDateKey(new Date());
  const since = dateKeyToDb(dbToDateKey(new Date(dateKeyToDb(today).getTime() - 60 * 86400000)));
  const plans = await db.leavePlan.findMany({
    where: {
      employee: employeeScope(actor),
      ...(opts.employeeId ? { employeeId: opts.employeeId } : { toDate: { gte: since } }),
    },
    include: { employee: true },
    orderBy: { fromDate: "desc" },
    take: 200,
  });
  return plans.map((p) => {
    const from = dbToDateKey(p.fromDate);
    const to = dbToDateKey(p.toDate);
    const state = p.status === "CANCELLED" ? "cancelled" : from > today ? "upcoming" : to >= today ? "on_leave" : "done";
    return {
      id: p.id,
      employeeId: p.employeeId,
      employee: p.employee.name,
      code: p.employee.code,
      from,
      to,
      days: Math.round((p.toDate.getTime() - p.fromDate.getTime()) / 86400000) + 1,
      paid: p.paid,
      reason: p.reason,
      status: p.status,
      plannedTo: p.plannedTo ? dbToDateKey(p.plannedTo) : null,
      state,
    };
  });
}
