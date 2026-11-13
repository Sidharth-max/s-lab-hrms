import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { Tabs } from "@/components/Tabs";
import { getActor } from "@/lib/auth";
import { countDays, STATUS_SHORT } from "@/lib/attendance";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { monthAttendance } from "@/lib/services";
import { hisaabOf } from "@/lib/ledger";
import { dbToDateKey, formatDateKey, formatMonth, istMonthKey } from "@/lib/time";

// Employee portal: view only.
export default async function MePage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "EMPLOYEE") redirect("/dashboard");
  const emp = await db.employee.findUnique({ where: { userId: actor.id }, include: { business: true, site: true } });
  if (!emp) redirect("/login");
  const month = istMonthKey(new Date());
  const [{ days }, h] = await Promise.all([monthAttendance(emp.businessId, month, [emp]), hisaabOf(emp)]);
  const list = days.get(emp.id)!;
  const c = countDays(list);
  const KIND: Record<string, string> = { advance: "Advance taken", payment: "Salary received", extra: "Extra pay", deduction: "Deduction" };

  const salary = (
    <section className="card">
      <h2 className="mb-2 font-semibold">My salary</h2>
      <div className="mb-3">
        <div className="text-xs text-[var(--muted)]">{h.balance >= 0 ? "Salary due to me" : "I owe (advance more than salary)"}</div>
        <div className={`text-2xl font-semibold tabular-nums ${h.balance < 0 ? "text-[var(--red)]" : ""}`}>{formatRs(Math.abs(h.balance))}</div>
        <p className="muted text-sm">Earned {formatRs(h.earned + h.extras)} since {formatDateKey(h.since)} · advances {formatRs(h.advances)} · received {formatRs(h.payments)}</p>
      </div>
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
  const money = (
    <section className="card">
      <h2 className="mb-2 font-semibold">Money taken and received</h2>
      {h.entries.filter((e) => !e.pending).length === 0 ? <p className="muted">Nothing yet.</p> : (
        <ul className="flex flex-col">
          {h.entries.filter((e) => !e.pending).map((e) => (
            <li key={`${e.kind}-${e.id}`} className="flex justify-between gap-3 border-b border-[var(--line)] py-2 text-sm last:border-0">
              <span>{KIND[e.kind]} <span className="muted">· {formatDateKey(e.date)}</span></span>
              <span className="font-semibold tabular-nums">{e.kind === "extra" ? "+" : "−"} {formatRs(e.amount)}</span>
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
          { id: "money", label: "Advances & payments", content: money },
        ]}
      />
    </main>
  );
}
