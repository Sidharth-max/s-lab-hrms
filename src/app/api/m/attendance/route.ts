import { STATUS_LABEL } from "@/lib/attendance";
import { db } from "@/lib/db";
import { json, staff } from "@/lib/api";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere, monthAttendance } from "@/lib/services";
import { formatIstTime, istDateKey } from "@/lib/time";

// Attendance for one day (?date=YYYY-MM-DD, default today).
export async function GET(req: Request) {
  return staff(async (actor) => {
    const today = istDateKey(new Date());
    const q = new URL(req.url).searchParams.get("date") ?? "";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q) && q <= today ? q : today;
    const employees = await db.employee.findMany({
      where: { ...employeeScope(actor), ...employedInMonthWhere(actor.businessId, date.slice(0, 7)) },
      include: { site: true },
      orderBy: { name: "asc" },
    });
    const { days } = await monthAttendance(actor.businessId, date.slice(0, 7), employees);
    const rows = employees
      .map((e) => ({ e, d: days.get(e.id)!.find((x) => x.date === date)! }))
      // Archived people are hidden from today; past days they worked still show (salary uses them).
      .filter((r) => r.d.status !== "NOT_EMPLOYED" && (r.e.active || date < today))
      .map(({ e, d }) => ({
        archived: !e.active,
        employeeId: e.id,
        name: e.name,
        code: e.code,
        site: e.site.name,
        status: d.status,
        statusLabel: STATUS_LABEL[d.status],
        inAt: d.inAt ? formatIstTime(d.inAt) : null,
        outAt: d.outAt ? formatIstTime(d.outAt) : null,
        workedMins: d.workedMins,
        missingOut: d.missingOut && !d.overridden,
        manual: d.overridden,
      }));
    return json({ date, today, rows });
  });
}
