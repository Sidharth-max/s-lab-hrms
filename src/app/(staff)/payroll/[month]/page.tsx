import Link from "next/link";
import { notFound } from "next/navigation";
import { addAdjustment, lockPayrollAction, recalcPayroll, recordPayment, reopenPayrollAction } from "@/app/actions/payroll";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRs, rsInput } from "@/lib/money";
import { can } from "@/lib/permissions";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere } from "@/lib/services";
import { addMonths, formatMonth, isMonthKey, istDateKey, istMonthKey } from "@/lib/time";

export default async function PayrollMonth({ params }: PageProps<"/payroll/[month]">) {
  const actor = await requireStaff();
  const { month } = await params;
  if (!isMonthKey(month) || month > istMonthKey(new Date())) notFound();
  const run = await db.payrollRun.findUnique({ where: { businessId_month: { businessId: actor.businessId, month } } });
  const lines = run
    ? await db.payrollLine.findMany({ where: { runId: run.id, employee: employeeScope(actor) }, include: { employee: true }, orderBy: { employee: { name: "asc" } } })
    : [];
  const [employees, adjustments] = await Promise.all([
    db.employee.findMany({ where: { ...employeeScope(actor), ...employedInMonthWhere(actor.businessId, month) }, orderBy: { name: "asc" } }),
    db.adjustment.findMany({ where: { month, employee: employeeScope(actor) }, include: { employee: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const locked = run?.status === "LOCKED";
  const sum = (k: "gross" | "pfEmployee" | "esiEmployee" | "advanceRecovered" | "net" | "paidAmount" | "pfEmployer" | "esiEmployer") =>
    lines.reduce((s, l) => s + l[k], 0);
  const isCurrent = month === istMonthKey(new Date());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/payroll" className="muted underline">← Salary</Link>
          <h1 className="h1">
            Salary · {formatMonth(month)}{" "}
            {run && (locked ? <span className="badge bg-green-100 text-green-800 align-middle">Locked</span> : <span className="badge bg-gray-100 align-middle">Draft</span>)}
          </h1>
          {run && !locked && <p className="muted">Last calculated {run.updatedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}. Recalculate after attendance or advance changes.</p>}
          {locked && run.lockedAt && <p className="muted">Locked {run.lockedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!locked && can(actor, "payroll.run") && (
            <ActionForm action={recalcPayroll} submitLabel={run ? "Recalculate" : "Calculate salary"} submitClass={run ? "btn-secondary" : "btn-primary"}>
              <input type="hidden" name="month" value={month} />
            </ActionForm>
          )}
          {run && !locked && can(actor, "payroll.lock") && (
            <ActionForm
              action={lockPayrollAction}
              submitLabel="Approve and lock"
              confirm={`${isCurrent ? "This month is not over yet. " : ""}Lock salary for ${formatMonth(month)}? Attendance for this month can then no longer be edited.`}
            >
              <input type="hidden" name="month" value={month} />
            </ActionForm>
          )}
          {locked && actor.role === "OWNER" && (
            <ActionForm action={reopenPayrollAction} submitLabel="Reopen (owner)" submitClass="btn-secondary" confirm="Reopen this locked month?">
              <input type="hidden" name="month" value={month} />
            </ActionForm>
          )}
          {run && <a className="btn-secondary" href={`/payroll/${month}/csv`}>Download Excel (CSV)</a>}
        </div>
      </div>

      {run && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card"><div className="muted">Gross</div><div className="text-xl font-bold">{formatRs(sum("gross"))}</div></div>
          <div className="card"><div className="muted">PF + ESIC (employee)</div><div className="text-xl font-bold">{formatRs(sum("pfEmployee") + sum("esiEmployee"))}</div></div>
          <div className="card"><div className="muted">Advance recovered</div><div className="text-xl font-bold">{formatRs(sum("advanceRecovered"))}</div></div>
          <div className="card"><div className="muted">Net to pay</div><div className="text-xl font-bold">{formatRs(sum("net"))}</div></div>
        </div>
      )}

      {run && (
        <div className="card overflow-x-auto !p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th><th>Rate</th><th>Days</th><th>Gross</th><th>Adj.</th><th>PF</th><th>ESIC</th><th>Advance</th><th>Net</th><th>Paid</th><th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium"><Link className="text-[var(--brand)]" href={`/employees/${l.employeeId}`}>{l.employee.name}</Link></td>
                  <td className="whitespace-nowrap">{formatRs(l.rate)}{l.wageType === "MONTHLY" ? "/m" : "/d"}</td>
                  <td>{l.payableDays}{l.wageType === "MONTHLY" ? ` / ${l.daysInMonth}` : ""}</td>
                  <td>{formatRs(l.gross)}</td>
                  <td>{l.adjustments ? formatRs(l.adjustments) : "—"}</td>
                  <td>{l.pfEmployee ? formatRs(l.pfEmployee) : "—"}</td>
                  <td>{l.esiEmployee ? formatRs(l.esiEmployee) : "—"}</td>
                  <td>{l.advanceRecovered ? formatRs(l.advanceRecovered) : "—"}</td>
                  <td className={`font-semibold ${l.net < 0 ? "text-red-600" : ""}`}>{formatRs(l.net)}</td>
                  <td>
                    {l.paidAmount ? `${formatRs(l.paidAmount)} ${l.paymentMode ?? ""}` : "—"}
                    {locked && can(actor, "payroll.lock") && (
                      <details>
                        <summary className="cursor-pointer text-xs text-[var(--brand)]">{l.paidAmount ? "Edit" : "Record payment"}</summary>
                        <ActionForm action={recordPayment} className="mt-2 flex min-w-[14rem] flex-col gap-2" submitLabel="Save">
                          <input type="hidden" name="lineId" value={l.id} />
                          <input name="amount" className="input" defaultValue={rsInput(l.paidAmount || Math.max(0, l.net))} inputMode="decimal" />
                          <select name="mode" className="input" defaultValue={l.paymentMode ?? "CASH"}>
                            <option value="CASH">Cash</option><option value="BANK">Bank transfer</option><option value="UPI">UPI</option><option value="CHEQUE">Cheque</option>
                          </select>
                          <input type="date" name="paidOn" className="input" defaultValue={istDateKey(new Date())} />
                          <input name="ref" className="input" placeholder="Reference (optional)" defaultValue={l.paymentRef ?? ""} />
                        </ActionForm>
                      </details>
                    )}
                  </td>
                  <td><Link className="text-[var(--brand)] underline" href={`/payslip/${l.id}`}>Payslip</Link></td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={11} className="muted">No employees in this month.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {run && (sum("pfEmployer") > 0 || sum("esiEmployer") > 0) && (
        <p className="muted">Employer share (not deducted from salary): PF {formatRs(sum("pfEmployer"))}, ESIC {formatRs(sum("esiEmployer"))}.</p>
      )}

      {can(actor, "payroll.run") && (
        <section className="card">
          <h2 className="mb-1 font-semibold">Adjustments for {formatMonth(month)}</h2>
          <p className="muted mb-3">One-off extra payment or deduction, for example a bonus, or a fix for a month that was already locked.</p>
          {!locked ? (
            <ActionForm action={addAdjustment} className="grid gap-3 sm:grid-cols-5" submitLabel="Add" resetOnSuccess>
              <input type="hidden" name="month" value={month} />
              <select name="employeeId" className="input sm:col-span-2" required>
                <option value="">Choose employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
              </select>
              <select name="kind" className="input"><option value="add">Add (+)</option><option value="deduct">Deduct (−)</option></select>
              <input name="amount" className="input" placeholder="Amount ₹" inputMode="decimal" required />
              <input name="reason" className="input" placeholder="Reason" required />
            </ActionForm>
          ) : (
            <p className="text-sm">This month is locked. Add adjustments to <Link className="underline" href={`/payroll/${addMonths(month, 1)}`}>{formatMonth(addMonths(month, 1))}</Link>.</p>
          )}
          {adjustments.length > 0 && (
            <table className="table mt-3">
              <thead><tr><th>Employee</th><th>Amount</th><th>Reason</th></tr></thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id}><td>{a.employee.name}</td><td>{formatRs(a.amount)}</td><td>{a.reason}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
