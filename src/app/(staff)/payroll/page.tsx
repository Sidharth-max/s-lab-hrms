import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { addMonths, formatMonth, isMonthKey, istMonthKey } from "@/lib/time";

export default async function PayrollList({ searchParams }: PageProps<"/payroll">) {
  const actor = await requireStaff();
  const sp = await searchParams;
  if (typeof sp.month === "string" && isMonthKey(sp.month)) redirect(`/payroll/${sp.month}`);
  const runs = await db.payrollRun.findMany({
    where: { businessId: actor.businessId },
    include: { lines: { select: { net: true, paidAmount: true } } },
    orderBy: { month: "desc" },
  });
  const current = istMonthKey(new Date());
  const suggestions = [addMonths(current, -1), current].filter((m) => !runs.some((r) => r.month === m));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Salary</h1>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((m) => <Link key={m} href={`/payroll/${m}`} className="btn-primary">Prepare {formatMonth(m)}</Link>)}
        <form className="flex gap-2">
          <input type="month" name="month" max={current} className="input" />
          <button className="btn-secondary">Open month</button>
        </form>
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead><tr><th>Month</th><th>Status</th><th>Employees</th><th>Net salary</th><th>Paid</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td><Link className="font-medium text-[var(--brand)]" href={`/payroll/${r.month}`}>{formatMonth(r.month)}</Link></td>
                <td>{r.status === "LOCKED" ? <span className="badge bg-green-100 text-green-800">Locked</span> : <span className="badge bg-gray-100">Draft</span>}</td>
                <td>{r.lines.length}</td>
                <td>{formatRs(r.lines.reduce((s, l) => s + l.net, 0))}</td>
                <td>{formatRs(r.lines.reduce((s, l) => s + l.paidAmount, 0))}</td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={5} className="muted">No salary prepared yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
