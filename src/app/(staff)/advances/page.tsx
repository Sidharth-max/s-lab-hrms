import Link from "next/link";
import { editAdvance, giveAdvance } from "@/app/actions/advances";
import { DateInput, MonthInput, Select } from "@/components/controls";
import { can } from "@/lib/permissions";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { employeeScope } from "@/lib/scope";
import { recoveredByAdvance } from "@/lib/services";
import { dbToDateKey, formatDateKey, formatMonth, istDateKey, istMonthKey } from "@/lib/time";

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
  const canGive = can(actor, "advances.manage");
  const people = canGive ? await db.employee.findMany({ where: employeeScope(actor, { active: true }), orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }) : [];
  const total = advances.filter((a) => a.status === "ACTIVE").reduce((s, a) => s + a.amount - (rec.get(a.id) ?? 0), 0);
  const STATUS: Record<string, string> = {
    PENDING_APPROVAL: "Waiting approval",
    ACTIVE: "Recovering",
    CLEARED: "Cleared",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };
  const owner = actor.role === "OWNER";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="h1">Advances</h1>
          <p className="muted">
            {"Total still to recover:"} <b>{formatRs(total)}</b>.
          </p>
        </div>
        <Link href={all ? "/advances" : "/advances?all=1"} className="btn-secondary">
          {all ? "Show open only" : "Show all (incl. cleared)"}
        </Link>
      </div>
      {canGive && (
        <details className="card">
          <summary className="flex cursor-pointer items-center justify-between font-semibold">Give advance<span className="btn-primary !h-8">New advance</span></summary>
          <ActionForm action={giveAdvance} className="mt-4 grid gap-3 @container @md:grid-cols-2" submitLabel="Save advance" resetOnSuccess>
            <div className="@md:col-span-2">
              <label className="label">Employee</label>
              <Select name="employeeId" defaultValue="" ariaLabel="Employee" options={[{ value: "", label: "Choose employee…" }, ...people.map((e) => ({ value: e.id, label: `${e.name} (${e.code})` }))]} />
            </div>
            <div><label className="label">Amount (₹)</label><input name="amount" className="input" inputMode="decimal" placeholder="e.g. 2000" required /></div>
            <div><label className="label">Given on</label><DateInput name="givenOn" defaultValue={istDateKey(new Date())} max={istDateKey(new Date())} /></div>
            <div>
              <label className="label">Recover over</label>
              <Select name="recoveryMonths" defaultValue="1" ariaLabel="Recover over" options={[{ value: "1", label: "Full, this month end" }, ...[2, 3, 4, 6].map((n) => ({ value: String(n), label: `${n} months` })), { value: "12", label: "12 months (1 year)" }]} />
            </div>
            <div><label className="label">First recovery month</label><MonthInput name="startMonth" defaultValue={istMonthKey(new Date())} /></div>
            <div className="@md:col-span-2"><label className="label">Note (optional)</label><input name="note" className="input" placeholder="e.g. medical…" /></div>
          </ActionForm>
        </details>
      )}
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr>
              <th>Employee</th><th>Given</th><th>Amount</th><th>Recovered</th>
              <th>Left</th><th>Plan</th><th>Status</th>{owner && <th />}
            </tr>
          </thead>
          <tbody>
            {advances.map((a) => {
              const r = rec.get(a.id) ?? 0;
              // Cancelled and rejected advances are not recovered: shown greyed out with the amount struck through.
              const dead = a.status === "CANCELLED" || a.status === "REJECTED";
              return (
                <tr key={a.id} className={dead ? "bg-[var(--soft)]/60 text-[var(--muted)] [&_a]:!text-[var(--muted)]" : ""}>
                  <td className="card-title"><Link className="font-medium hover:underline" href={`/employees/${a.employeeId}?advance=1`}>{a.employee.name}</Link></td>
                  <td data-label={"Given"}>{formatDateKey(dbToDateKey(a.givenOn))}</td>
                  <td data-label={"Amount"} className={dead ? "line-through" : ""}>{formatRs(a.amount)}</td>
                  <td data-label={"Recovered"}>{formatRs(r)}</td>
                  <td data-label={"Left"} className={dead ? "" : "font-semibold"}>{formatRs(a.status === "REJECTED" || a.status === "CANCELLED" ? 0 : a.amount - r)}</td>
                  <td data-label={"Plan"}>{a.recoveryMonths === 1 ? "Full" : `${a.recoveryMonths} months`} {"from"} {formatMonth(a.startMonth)}</td>
                  <td data-label={"Status"}>
                    <span className={`badge ${dead ? "badge-neutral opacity-70" : a.status === "CLEARED" ? "badge-green" : a.status === "PENDING_APPROVAL" ? "badge-amber" : "badge-neutral"}`}>{STATUS[a.status]}</span>
                  </td>
                  {owner && (
                    <td>
                      {(a.status === "ACTIVE" || a.status === "CLEARED") && (
                        <details>
                          <summary className="btn-secondary !py-1 cursor-pointer">Edit</summary>
                          <ActionForm action={editAdvance} className="mt-2 grid min-w-64 gap-2" submitLabel="Save changes">
                            <input type="hidden" name="advanceId" value={a.id} />
                            <label className="label">Amount (₹)<input name="amount" className="input" inputMode="decimal" defaultValue={a.amount / 100} required /></label>
                            <div><span className="label">Given on</span><DateInput name="givenOn" defaultValue={dbToDateKey(a.givenOn)} /></div>
                            <label className="label">Recover over (months)<input name="recoveryMonths" type="number" min={1} max={24} className="input" defaultValue={a.recoveryMonths} /></label>
                            <div><span className="label">First recovery month</span><MonthInput name="startMonth" defaultValue={a.startMonth} disabled={r > 0} /></div>
                            <label className="label">Note<input name="note" className="input" defaultValue={a.note ?? ""} /></label>
                          </ActionForm>
                          {r === 0 && (
                            <ActionForm action={editAdvance} className="mt-2" submitLabel="Cancel this advance" submitClass="btn-danger !py-1" confirm="Cancel this advance? It will no longer be recovered.">
                              <input type="hidden" name="advanceId" value={a.id} />
                              <input type="hidden" name="cancel" value="1" />
                            </ActionForm>
                          )}
                        </details>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {advances.length === 0 && <tr><td colSpan={owner ? 8 : 7} className="muted">No advances.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
