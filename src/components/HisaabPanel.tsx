import Link from "next/link";
import { giveAdvance } from "@/app/actions/advances";
import { addAdjustment, paySalary, removeAdjustment, voidPayment } from "@/app/actions/salary";
import { ActionForm } from "./ActionForm";
import { DateInput, Select } from "./controls";
import type { Hisaab } from "@/lib/ledger";
import { formatRs, rsInput } from "@/lib/money";
import { formatDateKey, formatMonth, istDateKey } from "@/lib/time";

const MODES = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank transfer" },
  { value: "UPI", label: "UPI" },
  { value: "CHEQUE", label: "Cheque" },
];
const KIND: Record<string, { label: string; sign: string; cls: string }> = {
  advance: { label: "Advance given", sign: "−", cls: "ink-orange" },
  payment: { label: "Salary paid", sign: "−", cls: "ink-blue" },
  extra: { label: "Extra pay", sign: "+", cls: "ink-pink" },
  deduction: { label: "Deduction", sign: "−", cls: "ink-red" },
};

export function balanceText(balance: number) {
  if (balance > 0) return `${formatRs(balance)} to pay`;
  if (balance < 0) return `${formatRs(-balance)} owed by employee`;
  return "Settled";
}

/**
 * The whole salary story of one employee: one running balance, no salary months.
 * Balance = earned since joining + extra pay − deductions − advances − salary paid.
 */
export function HisaabPanel({
  h,
  employee,
  wages,
  can,
  openAdvance,
}: {
  h: Hisaab;
  employee: { id: string; name: string; active: boolean };
  wages: { from: string; text: string }[];
  can: { pay: boolean; extras: boolean; advance: boolean; owner: boolean };
  openAdvance?: boolean;
}) {
  const today = istDateKey(new Date());
  const rows: [string, string, string][] = [
    [`Salary earned (${formatDateKey(h.since)} to ${formatDateKey(h.upTo)})`, formatRs(h.gross), "ink-violet"],
    ...(h.pf + h.esi > 0 ? ([["PF and ESIC (employee share)", `− ${formatRs(h.pf + h.esi)}`, "ink-red"]] as [string, string, string][]) : []),
    ...(h.extras !== 0 ? ([[h.extras > 0 ? "Extra pay minus deductions" : "Deductions minus extra pay", `${h.extras > 0 ? "+" : "−"} ${formatRs(Math.abs(h.extras))}`, h.extras > 0 ? "ink-pink" : "ink-red"]] as [string, string, string][]) : []),
    ["Advance given", `− ${formatRs(h.advances)}`, "ink-orange"],
    ["Salary paid", `− ${formatRs(h.payments)}`, "ink-blue"],
  ];
  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Salary ledger</h2>
          {h.lastPaidOn && <span className="muted text-sm">Last paid {formatDateKey(h.lastPaidOn)}</span>}
        </div>
        <div>
          <div className={`text-sm font-semibold ${h.balance < 0 ? "ink-red" : "ink-green"}`}>{h.balance > 0 ? "To pay now" : h.balance < 0 ? "Employee owes you" : "Ledger"}</div>
          <div className={`text-4xl font-bold tracking-tight tabular-nums ${h.balance < 0 ? "ink-red" : h.balance > 0 ? "ink-green" : ""}`}>{formatRs(Math.abs(h.balance))}</div>
          {h.balance === 0 && <p className="muted text-sm">All settled. Nothing to pay.</p>}
          {h.balance < 0 && <p className="muted text-sm">Advance is more than the salary earned. It comes off future salary by itself.</p>}
        </div>
        <dl className="flex flex-col text-sm">
          {rows.map(([k, v, ink]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-2 last:border-0">
              <dt className={`font-medium ${ink}`}>{k}</dt>
              <dd className={`font-semibold tabular-nums ${ink}`}>{v}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 pt-2">
            <dt className="font-semibold">Balance</dt>
            <dd className={`text-base font-bold tabular-nums ${h.balance < 0 ? "ink-red" : "ink-green"}`}>{h.balance < 0 ? "− " : ""}{formatRs(Math.abs(h.balance))}</dd>
          </div>
        </dl>
        {h.cashGross > 0 && (
          // Salary paid in two parts: PF / ESIC come off the bank part; advances and extras sit on the cash part.
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[var(--tint-blue)] p-3">
              <div className="text-xs font-semibold ink-blue">Bank to pay</div>
              <div className={`text-lg font-bold tabular-nums ${h.bankBalance < 0 ? "ink-red" : "ink-blue"}`}>{h.bankBalance < 0 ? "− " : ""}{formatRs(Math.abs(h.bankBalance))}</div>
              <div className="muted text-xs">after PF / ESIC</div>
            </div>
            <div className="rounded-xl bg-[var(--tint-orange)] p-3">
              <div className="text-xs font-semibold ink-orange">Cash to pay</div>
              <div className={`text-lg font-bold tabular-nums ${h.cashBalance < 0 ? "ink-red" : "ink-orange"}`}>{h.cashBalance < 0 ? "− " : ""}{formatRs(Math.abs(h.cashBalance))}</div>
              <div className="muted text-xs">after advances</div>
            </div>
          </div>
        )}
        {h.pendingAdvances > 0 && (
          <p className="text-sm text-[var(--red)]">
            {formatRs(h.pendingAdvances)} advance is waiting for approval and is not counted yet. <Link className="underline" href="/approvals">Open approvals</Link>
          </p>
        )}

        {can.pay && h.cashGross > 0 && h.balance > 0 && (
          <div className="grid gap-3 @md:grid-cols-2">
            {([
              ["bank", "Pay bank part", Math.max(0, Math.min(h.bankBalance, h.balance)), MODES.filter((m) => m.value !== "CASH"), "BANK"],
              ["cash", "Pay cash part", Math.max(0, Math.min(h.cashBalance, h.balance)), MODES.filter((m) => m.value === "CASH"), "CASH"],
            ] as const).map(([key, title, amount, modes, mode]) => (
              <details key={key} className="rounded-lg border border-[var(--line)] p-3" open={amount > 0}>
                <summary className="cursor-pointer font-semibold">{title} {formatRs(amount)}</summary>
                <ActionForm action={paySalary} className="mt-3 grid gap-3" submitLabel={`${title}`} confirm={`${title} to ${employee.name} now? It is recorded as salary paid.`} resetOnSuccess>
                  <input type="hidden" name="employeeId" value={employee.id} />
                  <div><label className="label">Amount (₹)</label><input name="amount" className="input" inputMode="decimal" defaultValue={rsInput(amount)} required /></div>
                  <div><label className="label">Paid on</label><DateInput name="paidOn" defaultValue={today} max={today} /></div>
                  {modes.length > 1 ? <div><label className="label">Paid by</label><Select name="mode" defaultValue={mode} ariaLabel="Payment mode" options={[...modes]} /></div> : <input type="hidden" name="mode" value={mode} />}
                  {key === "bank" ? <div><label className="label">Reference (optional)</label><input name="ref" className="input" placeholder="UTR, UPI or cheque number" /></div> : null}
                  <div><label className="label">Note (optional)</label><input name="note" className="input" /></div>
                </ActionForm>
              </details>
            ))}
          </div>
        )}
        {can.pay && h.cashGross === 0 && h.balance > 0 && (
          <details className="rounded-lg border border-[var(--line)] p-3" open>
            <summary className="cursor-pointer font-semibold">Pay {formatRs(h.balance)} to {employee.name}</summary>
            <p className="muted mt-2 text-sm">The full amount settles the ledger. You can also pay part of it; the rest stays due.</p>
            <ActionForm action={paySalary} className="mt-3 grid gap-3 @md:grid-cols-2" submitLabel={`Pay ${employee.name.split(" ")[0]}`} confirm={`Pay this amount to ${employee.name} now? It is recorded as salary paid.`} resetOnSuccess>
              <input type="hidden" name="employeeId" value={employee.id} />
              <div><label className="label">Amount (₹)</label><input name="amount" className="input" inputMode="decimal" defaultValue={rsInput(h.balance)} required /></div>
              <div><label className="label">Paid on</label><DateInput name="paidOn" defaultValue={today} max={today} /></div>
              <div><label className="label">Paid by</label><Select name="mode" defaultValue="CASH" ariaLabel="Payment mode" options={MODES} /></div>
              <div><label className="label">Reference (optional)</label><input name="ref" className="input" placeholder="UPI or cheque number" /></div>
              <div className="@md:col-span-2"><label className="label">Note (optional)</label><input name="note" className="input" placeholder="e.g. Salary till Diwali" /></div>
            </ActionForm>
          </details>
        )}
        {can.advance && employee.active && (
          <details className="rounded-lg border border-[var(--line)] p-3" open={openAdvance}>
            <summary className="cursor-pointer font-semibold ink-orange">Give advance to {employee.name.split(" ")[0]}</summary>
            <p className="muted mt-2 text-sm">The advance comes off the balance straight away.</p>
            <ActionForm action={giveAdvance} className="mt-3 grid gap-3 @md:grid-cols-2" submitLabel="Save advance" resetOnSuccess>
              <input type="hidden" name="employeeId" value={employee.id} />
              <div><label className="label">Amount (₹)</label><input name="amount" className="input" inputMode="decimal" required /></div>
              <div><label className="label">Date</label><DateInput name="givenOn" defaultValue={today} max={today} /></div>
              <div className="@md:col-span-2"><label className="label">Note (optional)</label><input name="note" className="input" /></div>
            </ActionForm>
          </details>
        )}
        {can.extras && (
          <details className="rounded-lg border border-[var(--line)] p-3">
            <summary className="cursor-pointer font-semibold ink-pink">Add extra pay or deduction</summary>
            <ActionForm action={addAdjustment} className="mt-3 grid gap-3 @md:grid-cols-2" submitLabel="Save" resetOnSuccess>
              <input type="hidden" name="employeeId" value={employee.id} />
              <div><label className="label">Type</label><Select name="kind" defaultValue="add" ariaLabel="Type" options={[{ value: "add", label: "Extra pay (bonus, overtime)" }, { value: "deduct", label: "Deduction (damage, fine)" }]} /></div>
              <div><label className="label">Amount (₹)</label><input name="amount" className="input" inputMode="decimal" required /></div>
              <div><label className="label">Date</label><DateInput name="date" defaultValue={today} max={today} /></div>
              <div><label className="label">Reason</label><input name="reason" className="input" required minLength={3} /></div>
            </ActionForm>
          </details>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">Money in and out</h2>
        {h.entries.length === 0 ? (
          <p className="muted">No advances, payments or extras yet.</p>
        ) : (
          <ul className="flex flex-col">
            {h.entries.map((e) => {
              const k = KIND[e.kind];
              const removable = can.owner && (e.kind === "payment" || e.kind === "extra" || e.kind === "deduction");
              return (
                <li key={`${e.kind}-${e.id}`} className={`flex items-start justify-between gap-3 border-b border-[var(--line)] py-2.5 text-sm last:border-0 ${e.pending ? "opacity-60" : ""}`}>
                  <div className="min-w-0">
                    <div className="font-medium">
                      <span className={k.cls}>{k.label}</span>
                      {e.pending && <span className="badge badge-amber ml-2">Waiting for approval</span>}
                    </div>
                    <div className="muted text-xs">
                      {formatDateKey(e.date)}
                      {e.mode ? ` · ${MODES.find((m) => m.value === e.mode)?.label ?? e.mode}` : ""}
                      {e.ref ? ` · ${e.ref}` : ""}
                      {e.note ? ` · ${e.note}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`font-semibold tabular-nums ${k.cls}`}>{k.sign} {formatRs(e.amount)}</span>
                    {removable && (
                      <ActionForm
                        action={e.kind === "payment" ? voidPayment : removeAdjustment}
                        submitLabel="Remove"
                        submitClass="btn-secondary !h-7 !px-2.5 text-xs"
                        confirm={`Remove this ${k.label.toLowerCase()} of ${formatRs(e.amount)}? The balance changes back.`}
                      >
                        <input type="hidden" name={e.kind === "payment" ? "paymentId" : "adjustmentId"} value={e.id} />
                      </ActionForm>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <details>
          <summary className="cursor-pointer font-semibold">How earnings are worked out</summary>
          <p className="muted mt-2 text-sm">
            Every day since joining counts at that day&apos;s salary. Monthly salary uses a 30-day month: one day is the salary ÷ 30 in every month, and a whole month (28, 30 or 31 days) gives the full salary; each unpaid day takes off salary ÷ 30.
            Present and paid leave count fully, half day counts half, absent and unpaid leave count nothing. Weekly offs and holidays are paid to monthly staff.
            Edit attendance on any date and this updates by itself.
          </p>
          {wages.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="font-medium">Salary rate</div>
              <ul className="muted">
                {wages.map((w) => <li key={w.from}>From {formatDateKey(w.from)}: {w.text}</li>)}
              </ul>
            </div>
          )}
          <table className="table mt-3 text-sm">
            <thead><tr><th>Period</th><th>Paid days</th><th>Earned</th></tr></thead>
            <tbody>
              {h.months.map((m) => (
                <tr key={m.month}>
                  <td>{formatMonth(m.month)}</td>
                  <td className="tabular-nums">{m.payableDays}</td>
                  <td className="tabular-nums">{formatRs(m.net)}{m.pf + m.esi > 0 ? <span className="muted text-xs"> (after PF/ESIC {formatRs(m.pf + m.esi)})</span> : null}</td>
                </tr>
              ))}
              {h.months.length === 0 && <tr><td colSpan={3} className="muted">Nothing earned yet.</td></tr>}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}
