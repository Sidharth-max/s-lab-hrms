import Link from "next/link";
import { Pencil } from "@/components/icons";
import { can } from "@/lib/permissions";
import { LiveRefresh } from "@/components/LiveRefresh";
import { requireStaff } from "@/lib/auth";
import { lateLabel, STATUS_LABEL, statusBadgeClass } from "@/lib/attendance";
import { db } from "@/lib/db";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere, monthAttendance } from "@/lib/services";
import { parseShow, showWhere } from "@/lib/show-filter";
import { ShowTabs } from "@/components/ShowTabs";
import { formatDateKey, formatIstTime, istDateKey } from "@/lib/time";
import { DateJump } from "@/components/DateJump";

function minsToText(m: number) {
  return m ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : "—";
}

export default async function AttendanceDay({ searchParams }: PageProps<"/attendance">) {
  const actor = await requireStaff();
  const sp = await searchParams;
  const today = istDateKey(new Date());
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const show = parseShow(sp.show);
  const employees = await db.employee.findMany({
    where: { ...employeeScope(actor), ...employedInMonthWhere(actor.businessId, date.slice(0, 7)), ...showWhere(show) },
    include: { site: true },
    orderBy: { name: "asc" },
  });
  const { days } = await monthAttendance(actor.businessId, date.slice(0, 7), employees);
  const rows = employees
    .map((e) => ({ e, d: days.get(e.id)!.find((x) => x.date === date)! }))
    .filter((r) => r.d.status !== "NOT_EMPLOYED");

  return (
    <div className="flex flex-col gap-4">
      <LiveRefresh kinds={["attendance", "employee"]} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="h1">{"Attendance"} · {formatDateKey(date)}</h1>
        <div className="flex flex-wrap gap-2">
          {/* Picking a date shows that day at once (no "Go" button). */}
          <DateJump value={date} max={today} today={today} />
          <Link href={`/attendance/register?month=${date.slice(0, 7)}`} className="btn-secondary">Monthly register</Link>
        </div>
      </div>
      {can(actor, "attendance.edit") && (
        <p className="muted">
          To add or change attendance for an earlier day: choose the date above, then press <b>Edit</b> next to the person. You can also open an employee and use the Attendance register.
        </p>
      )}
      <ShowTabs show={show} params={{ date: date === today ? undefined : date }} />
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr>
              <th>Employee</th><th>Site</th><th>Status</th>
              <th>In</th><th>Out</th><th>Worked</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, d }) => (
              <tr key={e.id}>
                <td className="card-title font-medium">{e.name} <span className="muted">{e.code}</span>{!e.active && <span className="badge badge-neutral ml-1">Archived</span>}</td>
                <td data-label={"Site"}>{e.site.name}</td>
                <td data-label={"Status"}>
                  <span>
                    <span className={statusBadgeClass(d.status)}>{d.auto ? "Present (auto)" : STATUS_LABEL[d.status]}</span>
                    {d.overridden && <span className="badge badge-neutral ml-1">manual</span>}
                    {d.missingOut && !d.overridden && <span className="badge badge-red ml-1">no out punch</span>}
                    {d.late && <span className="badge badge-red ml-1">{lateLabel(d.lateMins)}</span>}
                  </span>
                </td>
                <td data-label={"In"} className={d.late ? "ink-red font-semibold" : d.inAt ? "ink-teal font-semibold" : ""}>{d.inAt ? formatIstTime(d.inAt) : "—"}</td>
                <td data-label={"Out"} className={d.outAt ? "ink-blue font-semibold" : ""}>{d.outAt ? formatIstTime(d.outAt) : "—"}</td>
                <td data-label={"Worked"}>{minsToText(d.workedMins)}</td>
                <td><Link className="btn-secondary !h-9" href={`/attendance/${e.id}/${date}`}><Pencil size={14} aria-hidden />Edit</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">No employees for this date.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
