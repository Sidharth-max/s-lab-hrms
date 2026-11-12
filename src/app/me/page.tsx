import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { Tabs } from "@/components/Tabs";
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

  const salary = (
    <section className="card">
      <h2 className="mb-2 font-semibold">My salary</h2>
      <div className="grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-2">
        <div><span className="muted">{"Type"}:</span> {emp.wageType === "MONTHLY" ? "Monthly" : "Daily"}</div>
        <div>
          <span className="muted">{"Rate"}:</span> {formatRs(emp.wageType === "MONTHLY" ? emp.monthlyWage : emp.dailyWage)}
          {emp.wageType === "MONTHLY" ? " / month" : " / day"}
        </div>
        <div><span className="muted">PF:</span> {emp.pfEnabled ? "Yes" : "No"}</div>
        <div><span className="muted">ESIC:</span> {emp.esiEnabled ? "Yes" : "No"}</div>
        <div><span className="muted">{"Joined"}:</span> {formatDateKey(dbToDateKey(emp.joinedOn))}</div>
      </div>
    </section>
  );
  const attendance = (
    <section className="card">
      <h2 className="mb-2 font-semibold">{"Attendance"} · {formatMonth(month)}</h2>
      <p className="mb-2 text-sm">
        {"Present"} {c.present} · {"Absent"} {c.absent} · {"Leave"} {c.paidLeave + c.unpaidLeave}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {list.map((d) => (
          <div key={d.date} className="rounded border border-[var(--line)] p-1">
            <div className="muted">{Number(d.date.slice(8))}</div>
            <div className="font-semibold">{STATUS_SHORT[d.status] || "·"}</div>
          </div>
        ))}
      </div>
    </section>
  );
  const advance = (
    <section className="card">
      <h2 className="mb-2 font-semibold">Advance</h2>
      {open.length === 0 ? <p className="muted">No advance to repay.</p> : (
        <table className="table table-cards">
          <thead><tr><th>Given</th><th>Amount</th><th>Left to repay</th></tr></thead>
          <tbody>
            {open.map((a) => (
              <tr key={a.id}>
                <td data-label={"Given"}>{formatDateKey(dbToDateKey(a.givenOn))}</td>
                <td data-label={"Amount"}>{formatRs(a.amount)}</td>
                <td data-label={"Left to repay"} className="font-semibold">{formatRs(a.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
  const payslips = (
    <section className="card">
      <h2 className="mb-2 font-semibold">Payslips</h2>
      {lines.length === 0 ? <p className="muted">No payslips yet.</p> : (
        <ul className="flex flex-col gap-1">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between">
              <Link className="link" href={`/me/payslip/${l.id}`}>{formatMonth(l.run.month)}</Link>
              <span className="font-semibold">{formatRs(l.net)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <main className="cq mx-auto flex max-w-4xl flex-col gap-4 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold">{emp.business.name}</div>
          <div className="muted">{emp.name} · {emp.code} · {emp.site.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <form action={logout}><button className="btn-secondary">Log out</button></form>
        </div>
      </header>
      <Tabs
        tabs={[
          { id: "salary", label: "Salary", content: salary },
          { id: "attendance", label: "Attendance", content: attendance },
          { id: "advance", label: "Advance", content: advance },
          { id: "payslips", label: "Payslips", content: payslips },
        ]}
      />
    </main>
  );
}
