import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { Avatar } from "@/components/Avatar";
import { Coins, HandCoins } from "@/components/icons";
import { editAdvance, giveAdvance } from "@/app/actions/advances";
import { DateInput, Select } from "@/components/controls";
import { can } from "@/lib/permissions";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { employeeScope } from "@/lib/scope";
import { dbToDateKey, formatDateKey, istDateKey } from "@/lib/time";

export default async function AdvancesPage({ searchParams }: PageProps<"/advances">) {
  const actor = await requireStaff();
  const sp = await searchParams;
  const all = sp.all === "1";
  // Advances come straight off the salary balance. "Given" = counted; cancelled / rejected are kept for the record.
  const advances = await db.advance.findMany({
    where: { employee: employeeScope(actor), ...(all ? {} : { status: { in: ["ACTIVE", "CLEARED", "PENDING_APPROVAL"] } }) },
    include: { employee: true },
    orderBy: { givenOn: "desc" },
    take: 500,
  });
  const canGive = can(actor, "advances.manage");
  const people = canGive ? await db.employee.findMany({ where: employeeScope(actor, { active: true }), orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }) : [];
  const total = advances.filter((a) => a.status === "ACTIVE" || a.status === "CLEARED").reduce((s, a) => s + a.amount, 0);
  const STATUS: Record<string, string> = {
    PENDING_APPROVAL: "Waiting approval",
    ACTIVE: "Given",
    CLEARED: "Given",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };
  const owner = actor.role === "OWNER";

  return (
    <div className="flex flex-col gap-4">
      <PageHero
        icon={<Coins size={24} />}
        eyebrow="Advances"
        title={formatRs(total)}
        subtitle="Given. Each advance comes off that person's salary balance straight away (see Salary)."
        stats={[
          { label: "Given", value: advances.filter((a) => a.status === "ACTIVE" || a.status === "CLEARED").length },
          { label: "Waiting approval", value: advances.filter((a) => a.status === "PENDING_APPROVAL").length, alert: advances.some((a) => a.status === "PENDING_APPROVAL") },
        ]}
      />
      <div className="flex justify-end">
        <Link href={all ? "/advances" : "/advances?all=1"} className="btn-secondary">
          {all ? "Hide cancelled" : "Show cancelled and rejected too"}
        </Link>
      </div>
      {canGive && (
        <details className="card">
          <summary className="flex cursor-pointer items-center justify-between gap-3"><span className="section-title"><span className="icon-badge bg-[var(--tint-orange)] text-[var(--ink-orange)]" aria-hidden><HandCoins size={18} /></span>Give advance</span><span className="btn-primary !h-8">New advance</span></summary>
          <ActionForm action={giveAdvance} className="mt-4 grid gap-3 @container @md:grid-cols-2" submitLabel="Save advance" resetOnSuccess>
            <div className="@md:col-span-2">
              <label className="label">Employee</label>
              <Select name="employeeId" defaultValue="" ariaLabel="Employee" options={[{ value: "", label: "Choose employee…" }, ...people.map((e) => ({ value: e.id, label: `${e.name} (${e.code})` }))]} />
            </div>
            <div><label className="label">Amount (₹)</label><input name="amount" className="input" inputMode="decimal" placeholder="e.g. 2000" required /></div>
            <div><label className="label">Given on</label><DateInput name="givenOn" defaultValue={istDateKey(new Date())} max={istDateKey(new Date())} /></div>
            <div className="@md:col-span-2"><label className="label">Note (optional)</label><input name="note" className="input" placeholder="e.g. medical…" /></div>
          </ActionForm>
        </details>
      )}
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr>
              <th>Employee</th><th>Given</th><th>Amount</th><th>Note</th><th>Status</th>{owner && <th />}
            </tr>
          </thead>
          <tbody>
            {advances.map((a) => {
              // Cancelled and rejected advances do not count: shown greyed out with the amount struck through.
              const dead = a.status === "CANCELLED" || a.status === "REJECTED";
              return (
                <tr key={a.id} className={dead ? "bg-[var(--soft)]/60 text-[var(--muted)] [&_a]:!text-[var(--muted)]" : ""}>
                  <td className="card-title"><Link className="inline-flex items-center gap-2.5 font-semibold hover:underline" href={`/employees/${a.employeeId}?tab=ledger`}><Avatar name={a.employee.name} size={32} muted={dead} />{a.employee.name}</Link></td>
                  <td data-label={"Given"}>{formatDateKey(dbToDateKey(a.givenOn))}</td>
                  <td data-label={"Amount"} className={`font-semibold tabular-nums ${dead ? "line-through" : "ink-orange"}`}>{formatRs(a.amount)}</td>
                  <td data-label={"Note"}>{a.note ?? "—"}</td>
                  <td data-label={"Status"}>
                    <span className={`badge ${dead ? "badge-neutral opacity-70" : a.status === "PENDING_APPROVAL" ? "badge-amber" : "badge-neutral"}`}>{STATUS[a.status]}</span>
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
                            <label className="label">Note<input name="note" className="input" defaultValue={a.note ?? ""} /></label>
                          </ActionForm>
                          <ActionForm action={editAdvance} className="mt-2" submitLabel="Cancel this advance" submitClass="btn-danger !py-1" confirm="Cancel this advance? It is added back to the salary balance.">
                            <input type="hidden" name="advanceId" value={a.id} />
                            <input type="hidden" name="cancel" value="1" />
                          </ActionForm>
                        </details>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {advances.length === 0 && <tr><td colSpan={owner ? 6 : 5} className="muted">No advances.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
