import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { requireStaff } from "@/lib/auth";
import { countDays, STATUS_SHORT, type DerivedStatus } from "@/lib/attendance";
import { db } from "@/lib/db";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere, monthAttendance } from "@/lib/services";
import { addMonths, formatMonth, isMonthKey, istMonthKey, monthDates } from "@/lib/time";

const COLOR: Partial<Record<DerivedStatus, string>> = {
  PRESENT: "bg-green-50 text-[var(--green)]",
  HALF_DAY: "bg-amber-50 text-[var(--amber)]",
  ABSENT: "bg-red-50 text-[var(--red)]",
  PAID_LEAVE: "bg-[var(--soft)] text-[var(--text)]",
  UNPAID_LEAVE: "bg-red-50 text-[var(--red)] opacity-70",
  WEEKLY_OFF: "text-[var(--muted)]",
  HOLIDAY: "bg-[var(--soft)] text-[var(--muted)]",
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
        <h1 className="h1">{"Register"} · {formatMonth(month)}</h1>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`?month=${addMonths(month, -1)}${only ? `&employee=${only}` : ""}`}><ChevronLeft size={16} strokeWidth={1.75} aria-hidden />Prev</Link>
          {month < current && <Link className="btn-secondary" href={`?month=${addMonths(month, 1)}${only ? `&employee=${only}` : ""}`}>Next<ChevronRight size={16} strokeWidth={1.75} aria-hidden /></Link>}
          {only && <Link className="btn-secondary" href={`?month=${month}`}>All employees</Link>}
        </div>
      </div>
      <p className="muted">P present · H half day · A absent · PL paid leave · UL unpaid leave · WO weekly off · HO holiday · * edited · ! no out punch. Tap a day to edit.</p>
      {/* Phones: one card per employee with a month calendar. Wider screens: the full table. */}
      <div className="flex flex-col gap-3 md:hidden">
        {employees.map((e) => {
          const list = days.get(e.id)!;
          const c = countDays(list);
          const lead = new Date(`${month}-01T00:00:00Z`).getUTCDay();
          return (
            <section key={e.id} className="card flex flex-col gap-3">
              <Link href={`/employees/${e.id}`} className="flex items-center gap-3">
                <Avatar name={e.name} size={34} />
                <span className="min-w-0 flex-1 truncate font-medium">{e.name} <span className="font-normal text-[var(--muted)]">{e.code}</span></span>
                <ChevronRight size={16} className="text-[var(--muted)]" aria-hidden />
              </Link>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-green">Present {c.present}</span>
                <span className="badge badge-red">Absent {c.absent}</span>
                <span className="badge badge-neutral">Leave {c.paidLeave + c.unpaidLeave}</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="font-medium text-[var(--muted)]">{d}</span>)}
                {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
                {list.map((d) => {
                  const short = STATUS_SHORT[d.status];
                  const body = (
                    <>
                      <span className="block text-[10px] text-[var(--muted)]">{Number(d.date.slice(8))}</span>
                      <span className="block font-semibold">{short}{d.overridden ? "*" : ""}{d.missingOut && !d.overridden ? "!" : ""}</span>
                    </>
                  );
                  return short ? (
                    <Link key={d.date} href={`/attendance/${e.id}/${d.date}`} className={`rounded-md border border-[var(--line)] py-1 ${COLOR[d.status] ?? ""}`}>{body}</Link>
                  ) : (
                    <span key={d.date} className="rounded-md border border-[var(--line)] py-1 text-neutral-300">{body}</span>
                  );
                })}
              </div>
            </section>
          );
        })}
        {employees.length === 0 && <div className="card muted">No employees.</div>}
      </div>
      <div className="card hidden overflow-x-auto !p-0 md:block">
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
