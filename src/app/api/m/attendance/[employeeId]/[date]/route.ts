import { STATUS_LABEL } from "@/lib/attendance";
import { db } from "@/lib/db";
import { apiError, json, staff } from "@/lib/api";
import { can, canSeeSite } from "@/lib/permissions";
import { monthAttendance } from "@/lib/services";
import { dateKeyToDb, formatIstTime, istDateKey } from "@/lib/time";

// One employee's day: punches, manual edits and whether it can still be edited.
export async function GET(_req: Request, ctx: RouteContext<"/api/m/attendance/[employeeId]/[date]">) {
  return staff(async (actor) => {
    const { employeeId, date } = await ctx.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError("Bad date");
    const emp = await db.employee.findFirst({ where: { id: employeeId, businessId: actor.businessId } });
    if (!emp || !canSeeSite(actor, emp.siteId)) return apiError("Employee not found", 404);
    const [punches, overrides, run, { days }] = await Promise.all([
      db.attendancePunch.findMany({ where: { employeeId, workDate: dateKeyToDb(date) }, orderBy: { at: "asc" } }),
      db.dayOverride.findMany({ where: { employeeId, workDate: dateKeyToDb(date) }, orderBy: { createdAt: "desc" } }),
      db.payrollRun.findUnique({ where: { businessId_month: { businessId: actor.businessId, month: date.slice(0, 7) } } }),
      monthAttendance(actor.businessId, date.slice(0, 7), [emp]),
    ]);
    const ids = [...new Set([...punches.flatMap((p) => [p.createdBy, p.voidedBy]), ...overrides.map((o) => o.createdBy)].filter(Boolean) as string[])];
    const users = new Map((await db.user.findMany({ where: { id: { in: ids } } })).map((u) => [u.id, u.name]));
    const day = days.get(emp.id)!.find((d) => d.date === date)!;
    const locked = run?.status === "LOCKED";
    return json({
      employee: { id: emp.id, name: emp.name, code: emp.code },
      date,
      status: day.status,
      statusLabel: STATUS_LABEL[day.status],
      manual: day.overridden,
      locked,
      editable: can(actor, "attendance.edit") && !locked && date <= istDateKey(new Date()),
      punches: punches.map((p) => ({
        id: p.id,
        type: p.type,
        time: formatIstTime(p.at),
        source: p.source,
        score: p.score,
        reason: p.reason,
        by: p.createdBy ? users.get(p.createdBy) ?? null : null,
        voided: !!p.voidedAt,
        voidReason: p.voidReason,
      })),
      history: overrides.map((o) => ({ at: o.createdAt.toISOString(), by: users.get(o.createdBy) ?? null, status: o.status, reason: o.reason })),
    });
  });
}
