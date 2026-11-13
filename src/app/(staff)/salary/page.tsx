import Link from "next/link";
import { ShowTabs } from "@/components/ShowTabs";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { hisaabFor } from "@/lib/ledger";
import { formatRs } from "@/lib/money";
import { employeeScope } from "@/lib/scope";
import { parseShow, showWhere } from "@/lib/show-filter";
import { formatDateKey } from "@/lib/time";

// Everyone's salary hisaab: one running balance per person, no salary months.
export default async function SalaryPage({ searchParams }: PageProps<"/salary">) {
  const actor = await requireStaff();
  const sp = await searchParams;
  const show = parseShow(sp.show);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const employees = await db.employee.findMany({
    where: { ...employeeScope(actor), ...showWhere(show), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}) },
    orderBy: { name: "asc" },
  });
  const all = await hisaabFor(actor.businessId, employees);
  const rows = employees.map((e) => ({ e, h: all.get(e.id)! }));
  const toPay = rows.reduce((s, r) => s + Math.max(0, r.h.balance), 0);
  const owed = rows.reduce((s, r) => s + Math.max(0, -r.h.balance), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="h1">Salary</h1>
          <p className="muted">One running hisaab per person: salary earned since joining, minus advances and salary paid. Open a person to pay or clear it.</p>
        </div>
        <a className="btn-secondary" href={`/salary/csv?show=${show}`}>Download CSV</a>
      </div>
      <div className="grid grid-cols-2 gap-2 @lg:grid-cols-3">
        <div className="card !p-3"><div className="text-xs text-[var(--muted)]">Total to pay</div><div className="mt-0.5 text-lg font-semibold tabular-nums">{formatRs(toPay)}</div></div>
        <div className="card !p-3"><div className="text-xs text-[var(--muted)]">Owed by employees (advance more than salary)</div><div className={`mt-0.5 text-lg font-semibold tabular-nums ${owed ? "text-[var(--red)]" : ""}`}>{formatRs(owed)}</div></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ShowTabs show={show} params={{ q: q || undefined }} />
        <form className="flex min-w-0 flex-1 gap-2">
          {show !== "active" && <input type="hidden" name="show" value={show} />}
          <input name="q" defaultValue={q} className="input min-w-0 flex-1" placeholder="Search name or code…" aria-label="Search employee" />
        </form>
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr><th>Employee</th><th>Salary earned</th><th>Advances</th><th>Paid</th><th>Last paid</th><th>Balance</th></tr>
          </thead>
          <tbody>
            {rows.map(({ e, h }) => (
              <tr key={e.id}>
                <td className="card-title">
                  <Link className="font-medium text-[var(--text)] hover:underline" href={`/employees/${e.id}?tab=hisaab`}>{e.name}</Link>{" "}
                  <span className="muted text-xs">{e.code}</span>
                  {!e.active && <span className="badge badge-neutral ml-2">Archived</span>}
                </td>
                <td data-label="Salary earned" className="tabular-nums">{formatRs(h.earned + h.extras)}</td>
                <td data-label="Advances" className="tabular-nums">{formatRs(h.advances)}</td>
                <td data-label="Paid" className="tabular-nums">{formatRs(h.payments)}</td>
                <td data-label="Last paid">{h.lastPaidOn ? formatDateKey(h.lastPaidOn) : "—"}</td>
                <td data-label="Balance" className={`font-semibold tabular-nums ${h.balance < 0 ? "text-[var(--red)]" : ""}`}>
                  {h.balance === 0 ? <span className="badge badge-green">Clear</span> : h.balance < 0 ? `Owes ${formatRs(-h.balance)}` : formatRs(h.balance)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">No employees.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
