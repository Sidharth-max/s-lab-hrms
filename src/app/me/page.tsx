import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { getActor } from "@/lib/auth";
import { countDays, STATUS_SHORT } from "@/lib/attendance";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { monthAttendance, outstandingAdvances } from "@/lib/services";
import { dbToDateKey, formatDateKey, formatMonth, istMonthKey } from "@/lib/time";

// Employee portal: view only.
export default async function MePage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "EMPLOYEE") redirect("/dashboard");
  const emp = await db.employee.findUnique({ where: { userId: actor.id }, include: { business: true, site: true } });
  if (!emp) redirect("/login");
  const month = istMonthKey(new Date());
  const [{ days }, advances, lines] = await Promise.all([
    monthAttendance(emp.businessId, month, [emp]),
    outstandingAdvances(emp.id),
    db.payrollLine.findMany({ where: { employeeId: emp.id, run: { status: "LOCKED" } }, include: { run: true }, orderBy: { run: { month: "desc" } }, take: 24 }),
  ]);
  const list = days.get(emp.id)!;
  const c = countDays(list);
  const open = advances.filter((a) => a.remaining > 0);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="font-bold">{emp.business.name}</div>
          <div className="muted">{emp.name} · {emp.code} · {emp.site.name}</div>
        </div>
        <form action={logout}><button className="btn-secondary">Log out</button></form>
      </header>

      <section className="card">
        <h2 className="mb-2 font-semibold">मेरी सैलरी / My salary</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="muted">Type:</span> {emp.wageType === "MONTHLY" ? "Monthly" : "Daily"}</div>
          <div><span className="muted">Rate:</span> {formatRs(emp.wageType === "MONTHLY" ? emp.monthlyWage : emp.dailyWage)}{emp.wageType === "MONTHLY" ? " / month" : " / day"}</div>
          <div><span className="muted">PF:</span> {emp.pfEnabled ? "Yes" : "No"}</div>
          <div><span className="muted">ESIC:</span> {emp.esiEnabled ? "Yes" : "No"}</div>
          <div><span className="muted">Joined:</span> {formatDateKey(dbToDateKey(emp.joinedOn))}</div>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">हाज़िरी / Attendance · {formatMonth(month)}</h2>
        <p className="mb-2 text-sm">Present {c.present} · Absent {c.absent} · Leave {c.paidLeave + c.unpaidLeave}</p>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {list.map((d) => (
            <div key={d.date} className="rounded border border-[var(--line)] p-1">
              <div className="muted">{Number(d.date.slice(8))}</div>
              <div className="font-semibold">{STATUS_SHORT[d.status] || "·"}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">एडवांस / Advance</h2>
        {open.length === 0 ? <p className="muted">No advance to repay.</p> : (
          <table className="table">
            <thead><tr><th>Given</th><th>Amount</th><th>Left to repay</th></tr></thead>
            <tbody>
              {open.map((a) => (
                <tr key={a.id}><td>{formatDateKey(dbToDateKey(a.givenOn))}</td><td>{formatRs(a.amount)}</td><td className="font-semibold">{formatRs(a.remaining)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">सैलरी स्लिप / Payslips</h2>
        {lines.length === 0 ? <p className="muted">No payslips yet.</p> : (
          <ul className="flex flex-col gap-1">
            {lines.map((l) => (
              <li key={l.id} className="flex justify-between">
                <Link className="text-[var(--brand)] underline" href={`/me/payslip/${l.id}`}>{formatMonth(l.run.month)}</Link>
                <span className="font-semibold">{formatRs(l.net)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
