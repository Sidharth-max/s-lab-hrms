import { countDays, STATUS_SHORT } from "@/lib/attendance";
import { db } from "@/lib/db";
import { json, staff } from "@/lib/api";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere, monthAttendance } from "@/lib/services";
import { isMonthKey, istMonthKey, monthDates } from "@/lib/time";

// Monthly attendance register (?month=YYYY-MM, optional &employeeId= for one person's calendar).
export async function GET(req: Request) {
  return staff(async (actor) => {
    const current = istMonthKey(new Date());
    const params = new URL(req.url).searchParams;
    const q = params.get("month") ?? "";
    const only = params.get("employeeId");
    const month = isMonthKey(q) && q <= current ? q : current;
    const employees = await db.employee.findMany({ where: { ...employeeScope(actor), ...employedInMonthWhere(actor.businessId, month), ...(only ? { id: only } : {}) }, orderBy: { name: "asc" } });
    const { days } = await monthAttendance(actor.businessId, month, employees);
    return json({
      month,
      current,
      dates: monthDates(month),
      rows: employees.map((e) => {
        const list = days.get(e.id)!;
        const c = countDays(list);
        return {
          employeeId: e.id,
          name: e.name,
          days: list.map((d) => ({ date: d.date, status: d.status, short: STATUS_SHORT[d.status], manual: d.overridden, missingOut: d.missingOut && !d.overridden })),
          present: c.present,
          absent: c.absent,
          leave: c.paidLeave + c.unpaidLeave,
        };
      }),
    });
  });
}
