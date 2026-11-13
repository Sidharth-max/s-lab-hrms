import { STATUS_LABEL } from "@/lib/attendance";
import { db } from "@/lib/db";
import { parseDayRules } from "@/lib/day-rules";
import { env } from "@/lib/env";
import { json, staff } from "@/lib/api";
import { employeeScope } from "@/lib/scope";
import { monthAttendance } from "@/lib/services";
import { formatIstTime, istDateKey, weekday } from "@/lib/time";

// Today screen: who is in, who has not come, who still needs a face photo.
export async function GET() {
  return staff(async (actor) => {
    const today = istDateKey(new Date());
    const [employees, business, pending] = await Promise.all([
      db.employee.findMany({ where: employeeScope(actor, { active: true }), include: { site: true }, orderBy: { name: "asc" } }),
      db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
      db.approvalRequest.count({ where: { businessId: actor.businessId, status: "PENDING" } }),
    ]);
    const { days } = await monthAttendance(actor.businessId, today.slice(0, 7), employees);
    const rows = employees.map((e) => {
      const d = days.get(e.id)!.find((x) => x.date === today)!;
      return {
        id: e.id,
        name: e.name,
        code: e.code,
        site: e.site.name,
        status: d.status,
        statusLabel: STATUS_LABEL[d.status],
        inAt: d.inAt ? formatIstTime(d.inAt) : null,
        outAt: d.outAt ? formatIstTime(d.outAt) : null,
        inside: d.missingOut,
        manual: d.overridden,
        needsFace: !e.faceId || (env.faceProvider === "aws" && e.faceId.startsWith("mock-")),
      };
    });
    const rule = parseDayRules(business.dayRules)[weekday(today)];
    return json({
      date: today,
      storeHours: business.weeklyOffDays.includes(weekday(today)) ? null : { open: rule.open, close: rule.close, anyScanFullDay: rule.anyScanFullDay },
      counts: {
        total: rows.length,
        present: rows.filter((r) => r.status === "PRESENT" || r.status === "HALF_DAY").length,
        inside: rows.filter((r) => r.inside).length,
        notIn: rows.filter((r) => r.status === "ABSENT").length,
        pendingApprovals: pending,
      },
      rows,
    });
  });
}
