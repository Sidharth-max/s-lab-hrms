import Link from "next/link";
import { ShowTabs } from "@/components/ShowTabs";
import { ArrowDownLeft, ArrowUpRight, Download } from "@/components/icons";
import { requireStaff } from "@/lib/auth";
import { formatRs } from "@/lib/money";
import { buildSalaryView } from "@/lib/salary-view";
import { parseShow } from "@/lib/show-filter";
import { formatDateKey } from "@/lib/time";

// Salary: who needs to be paid and how much. Same data model and the same sections as the app's
// Salary tab (src/lib/salary-view.ts): total to pay, paid / advances this month, then one row per
// person with earned (violet), advances (orange), paid (blue) and the balance (green, red if owed).
export default async function SalaryPage({ searchParams }: PageProps<"/salary">) {
  const actor = await requireStaff();
  const sp = await searchParams;
  const show = parseShow(sp.show);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const v = await buildSalaryView(actor, show, q);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="h1">Salary</h1>
          <p className="muted">
            <b className="ink-violet">Earned</b> minus <b className="ink-orange">advances</b> and <b className="ink-blue">salary paid</b> = <b className="ink-green">to pay</b>. Open a person to pay them.
          </p>
        </div>
        <a className="btn-secondary" href={`/salary/csv?show=${show}`}><Download size={16} aria-hidden />Download CSV</a>
      </div>

      <section className="card rise grid gap-4 @lg:grid-cols-[1.3fr_1fr_1fr] @lg:items-center">
        <div>
          <div className="text-sm font-semibold text-[var(--muted)]">Total to pay now</div>
          <div className="ink-green text-4xl font-bold tracking-tight tabular-nums">{formatRs(v.toPay)}</div>
          <div className="muted text-sm">
            {v.due} {v.due === 1 ? "person is" : "people are"} due{v.owed > 0 && <> · <b className="ink-red">{formatRs(v.owed)}</b> owed by staff</>}
          </div>
        </div>
        <div className="rounded-2xl p-3" style={{ background: "var(--tint-blue)" }}>
          <div className="ink-blue flex items-center gap-1.5 text-xs font-semibold"><ArrowUpRight size={15} aria-hidden />Salary paid · this month</div>
          <div className="ink-blue text-lg font-bold tabular-nums">{formatRs(v.paidThisMonth)}</div>
        </div>
        <div className="rounded-2xl p-3" style={{ background: "var(--tint-orange)" }}>
          <div className="ink-orange flex items-center gap-1.5 text-xs font-semibold"><ArrowDownLeft size={15} aria-hidden />Advances · this month</div>
          <div className="ink-orange text-lg font-bold tabular-nums">{formatRs(v.advancesThisMonth)}</div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <ShowTabs show={show} params={{ q: q || undefined }} />
        {/* Desktop filter. On phones, search lives in the round button next to the bottom bar. */}
        <form className="hidden min-w-0 flex-1 gap-2 sm:flex">
          {show !== "active" && <input type="hidden" name="show" value={show} />}
          <input name="q" defaultValue={q} className="input min-w-0 flex-1" placeholder="Search name or code…" aria-label="Search employee" />
        </form>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr><th>Employee</th><th>Earned</th><th>Advances</th><th>Paid</th><th>Last paid</th><th>Balance</th></tr>
          </thead>
          <tbody className="rise-list">
            {v.rows.map((r) => (
              <tr key={r.employeeId}>
                <td className="card-title">
                  <Link className="font-medium text-[var(--text)] hover:underline" href={`/employees/${r.employeeId}?tab=ledger`}>{r.name}</Link>{" "}
                  <span className="muted text-xs">{r.code}</span>
                  {!r.active && <span className="badge badge-neutral ml-2">Archived</span>}
                </td>
                <td data-label="Earned" className="ink-violet font-semibold tabular-nums">{formatRs(r.earned)}</td>
                <td data-label="Advances" className="ink-orange font-semibold tabular-nums">{formatRs(r.advances)}</td>
                <td data-label="Paid" className="ink-blue font-semibold tabular-nums">{formatRs(r.payments)}</td>
                <td data-label="Last paid">{r.lastPaidOn ? formatDateKey(r.lastPaidOn) : "Never"}</td>
                <td data-label="Balance" className={`font-bold tabular-nums ${r.balance < 0 ? "ink-red" : "ink-green"}`}>
                  {r.balance === 0 ? <span className="badge badge-green">Clear</span> : r.balance < 0 ? `Owes ${formatRs(-r.balance)}` : <Link href={`/employees/${r.employeeId}?tab=ledger`} className="hover:underline">{formatRs(r.balance)} to pay</Link>}
                </td>
              </tr>
            ))}
            {v.rows.length === 0 && <tr><td colSpan={6} className="muted">No employees.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
