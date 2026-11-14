import { STATUS_LABEL } from "@/lib/attendance";
import { db } from "@/lib/db";
import { json, staff } from "@/lib/api";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere, monthAttendance } from "@/lib/services";
import { parseShow, showWhere } from "@/lib/show-filter";
import { formatIstTime, istDateKey } from "@/lib/time";

// Attendance for one day (?date=YYYY-MM-DD, default today).
export async function GET(req: Request) {
  return staff(async (actor) => {
    const today = istDateKey(new Date());
    const params = new URL(req.url).searchParams;
    const q = params.get("date") ?? "";
    const show = parseShow(params.get("show"));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q) && q <= today ? q : today;
    const employees = await db.employee.findMany({
      where: { ...employeeScope(actor), ...employedInMonthWhere(actor.businessId, date.slice(0, 7)), ...showWhere(show) },
      include: { site: true },
      orderBy: { name: "asc" },
    });
    const { days } = await monthAttendance(actor.businessId, date.slice(0, 7), employees);
    const rows = employees
      .map((e) => ({ e, d: days.get(e.id)!.find((x) => x.date === date)! }))
      .filter((r) => r.d.status !== "NOT_EMPLOYED")
      .map(({ e, d }) => ({
        archived: !e.active,
        employeeId: e.id,
        name: e.name,
        code: e.code,
        site: e.site.name,
        status: d.status,
        statusLabel: d.auto ? "Present (auto)" : STATUS_LABEL[d.status],
        inAt: d.inAt ? formatIstTime(d.inAt) : null,
        outAt: d.outAt ? formatIstTime(d.outAt) : null,
        workedMins: d.workedMins,
        missingOut: d.missingOut && !d.overridden,
        manual: d.overridden,
        late: d.late,
        lateMins: d.lateMins,
        early: d.early,
        earlyMins: d.earlyMins,
      }));
    return json({ date, today, show, rows });
  });
}
