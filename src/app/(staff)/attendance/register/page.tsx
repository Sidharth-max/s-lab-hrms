import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { countDays, STATUS_SHORT, type DerivedStatus } from "@/lib/attendance";
import { db } from "@/lib/db";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere, monthAttendance } from "@/lib/services";
import { addMonths, formatMonth, isMonthKey, istMonthKey, monthDates } from "@/lib/time";

const COLOR: Partial<Record<DerivedStatus, string>> = {
  PRESENT: "bg-green-100 text-green-900",
  HALF_DAY: "bg-lime-100 text-lime-900",
  ABSENT: "bg-red-100 text-red-900",
  PAID_LEAVE: "bg-blue-100 text-blue-900",
  UNPAID_LEAVE: "bg-orange-100 text-orange-900",
  WEEKLY_OFF: "bg-gray-100 text-gray-600",
  HOLIDAY: "bg-purple-100 text-purple-900",
};

export default async function Register({ searchParams }: PageProps<"/attendance/register">) {
  const actor = await requireStaff();
  const sp = await searchParams;
  const current = istMonthKey(new Date());
  const month = typeof sp.month === "string" && isMonthKey(sp.month) && sp.month <= current ? sp.month : current;
  const only = typeof sp.employee === "string" ? sp.employee : undefined;
  const employees = await db.employee.findMany({
    where: { ...employeeScope(actor), ...employedInMonthWhere(actor.businessId, month), ...(only ? { id: only } : {}) },
    orderBy: { name: "asc" },
  });
  const { days } = await monthAttendance(actor.businessId, month, employees);
  const dates = monthDates(month);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Register · {formatMonth(month)}</h1>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`?month=${addMonths(month, -1)}${only ? `&employee=${only}` : ""}`}>← Prev</Link>
          {month < current && <Link className="btn-secondary" href={`?month=${addMonths(month, 1)}${only ? `&employee=${only}` : ""}`}>Next →</Link>}
          {only && <Link className="btn-secondary" href={`?month=${month}`}>All employees</Link>}
        </div>
      </div>
      <p className="muted">P present · H half day · A absent · PL paid leave · UL unpaid leave · WO weekly off · HO holiday · * edited · ! no out punch. Tap a day to edit.</p>
      <div className="card overflow-x-auto !p-0">
        <table className="table text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white">Employee</th>
              {dates.map((d) => <th key={d} className="!px-1 text-center">{Number(d.slice(8))}</th>)}
              <th>Present</th><th>Absent</th><th>Leave</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const list = days.get(e.id)!;
              const c = countDays(list);
              return (
                <tr key={e.id}>
                  <td className="sticky left-0 bg-white font-medium whitespace-nowrap">{e.name}</td>
                  {list.map((d) => (
                    <td key={d.date} className="!px-0.5 text-center">
                      {STATUS_SHORT[d.status] ? (
                        <Link href={`/attendance/${e.id}/${d.date}`} className={`block rounded px-1 py-0.5 font-semibold ${COLOR[d.status] ?? ""}`}>
                          {STATUS_SHORT[d.status]}{d.overridden ? "*" : ""}{d.missingOut && !d.overridden ? "!" : ""}
                        </Link>
                      ) : null}
                    </td>
                  ))}
                  <td>{c.present}</td><td>{c.absent}</td><td>{c.paidLeave + c.unpaidLeave}</td>
                </tr>
              );
            })}
            {employees.length === 0 && <tr><td colSpan={dates.length + 4} className="muted">No employees.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
