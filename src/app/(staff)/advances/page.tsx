import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { employeeScope } from "@/lib/scope";
import { recoveredByAdvance } from "@/lib/services";
import { dbToDateKey, formatDateKey, formatMonth } from "@/lib/time";

const STATUS: Record<string, string> = {
  PENDING_APPROVAL: "Waiting approval",
  ACTIVE: "Recovering",
  CLEARED: "Cleared",
  REJECTED: "Rejected",
};

export default async function AdvancesPage({ searchParams }: PageProps<"/advances">) {
  const actor = await requireStaff();
  const sp = await searchParams;
  const all = sp.all === "1";
  const advances = await db.advance.findMany({
    where: { employee: employeeScope(actor), ...(all ? {} : { status: { in: ["ACTIVE", "PENDING_APPROVAL"] } }) },
    include: { employee: true },
    orderBy: { givenOn: "desc" },
    take: 500,
  });
  const rec = await recoveredByAdvance(advances.map((a) => a.id));
  const total = advances.filter((a) => a.status === "ACTIVE").reduce((s, a) => s + a.amount - (rec.get(a.id) ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="h1">Advances</h1>
          <p className="muted">Total still to recover: <b>{formatRs(total)}</b>. To give an advance, open the employee.</p>
        </div>
        <Link href={all ? "/advances" : "/advances?all=1"} className="btn-secondary">{all ? "Show open only" : "Show all (incl. cleared)"}</Link>
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead><tr><th>Employee</th><th>Given</th><th>Amount</th><th>Recovered</th><th>Left</th><th>Plan</th><th>Status</th></tr></thead>
          <tbody>
            {advances.map((a) => {
              const r = rec.get(a.id) ?? 0;
              return (
                <tr key={a.id}>
                  <td><Link className="text-[var(--brand)]" href={`/employees/${a.employeeId}`}>{a.employee.name}</Link></td>
                  <td>{formatDateKey(dbToDateKey(a.givenOn))}</td>
                  <td>{formatRs(a.amount)}</td>
                  <td>{formatRs(r)}</td>
                  <td className="font-semibold">{formatRs(a.status === "REJECTED" ? 0 : a.amount - r)}</td>
                  <td>{a.recoveryMonths === 1 ? "Full" : `${a.recoveryMonths} months`} from {formatMonth(a.startMonth)}</td>
                  <td>{STATUS[a.status]}</td>
                </tr>
              );
            })}
            {advances.length === 0 && <tr><td colSpan={7} className="muted">No advances.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
