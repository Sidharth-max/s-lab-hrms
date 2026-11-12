import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/attendance";
import { db } from "@/lib/db";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere, monthAttendance } from "@/lib/services";
import { formatDateKey, formatIstTime, istDateKey } from "@/lib/time";

function minsToText(m: number) {
  return m ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : "—";
}

export default async function AttendanceDay({ searchParams }: PageProps<"/attendance">) {
  const actor = await requireStaff();
  const sp = await searchParams;
  const today = istDateKey(new Date());
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const employees = await db.employee.findMany({
    where: { ...employeeScope(actor), ...employedInMonthWhere(actor.businessId, date.slice(0, 7)) },
    include: { site: true },
    orderBy: { name: "asc" },
  });
  const { days } = await monthAttendance(actor.businessId, date.slice(0, 7), employees);
  const rows = employees
    .map((e) => ({ e, d: days.get(e.id)!.find((x) => x.date === date)! }))
    .filter((r) => r.d.status !== "NOT_EMPLOYED");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="h1">Attendance · {formatDateKey(date)}</h1>
        <div className="flex flex-wrap gap-2">
          <form className="flex gap-2">
            <input type="date" name="date" defaultValue={date} max={today} className="input" />
            <button className="btn-secondary">Go</button>
          </form>
          <Link href={`/attendance/register?month=${date.slice(0, 7)}`} className="btn-secondary">Monthly register</Link>
        </div>
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr><th>Employee</th><th>Site</th><th>Status</th><th>In</th><th>Out</th><th>Worked</th><th /></tr>
          </thead>
          <tbody>
            {rows.map(({ e, d }) => (
              <tr key={e.id}>
                <td className="font-medium">{e.name} <span className="muted">{e.code}</span></td>
                <td>{e.site.name}</td>
                <td>
                  {STATUS_LABEL[d.status]}
                  {d.overridden && <span className="badge ml-1 bg-blue-50 text-[var(--brand)]">manual</span>}
                  {d.missingOut && !d.overridden && <span className="badge ml-1 bg-amber-100 text-amber-800">no out punch</span>}
                </td>
                <td>{d.inAt ? formatIstTime(d.inAt) : "—"}</td>
                <td>{d.outAt ? formatIstTime(d.outAt) : "—"}</td>
                <td>{minsToText(d.workedMins)}</td>
                <td><Link className="text-[var(--brand)] underline" href={`/attendance/${e.id}/${date}`}>Details / edit</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">No employees for this date.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
