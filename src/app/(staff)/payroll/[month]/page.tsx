import Link from "next/link";
import { BackLink } from "@/components/BackLink";
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
import { DateInput, Select } from "@/components/controls";

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
  const when = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const L = {
    rate: "Rate",
    days: "Days",
    gross: "Gross",
    adj: "Adjustment",
    adv: "Advance",
    net: "Net",
    paid: "Paid",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <BackLink href="/payroll" label="Salary" />
          <h1 className="h1">
            {"Salary"} · {formatMonth(month)}{" "}
            {run && (locked ? <span className="badge badge-green align-middle">Locked</span> : <span className="badge badge-neutral align-middle">Draft</span>)}
          </h1>
          {run && !locked && (
            <p className="muted">
              {`Last calculated ${when(run.updatedAt)}. Recalculate after attendance or advance changes.`}
            </p>
          )}
          {locked && run.lockedAt && <p className="muted">{"Locked"} {when(run.lockedAt)}</p>}
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
              submitLabel={"Approve and lock"}
              confirm={
                (isCurrent ? "This month is not over yet. " : "") +
                `Lock salary for ${formatMonth(month)}? Attendance for this month can then no longer be edited.`
              }
            >
              <input type="hidden" name="month" value={month} />
            </ActionForm>
          )}
          {locked && actor.role === "OWNER" && (
            <ActionForm action={reopenPayrollAction} submitLabel={"Reopen (owner)"} submitClass="btn-secondary" confirm={"Reopen this locked month?"}>
              <input type="hidden" name="month" value={month} />
            </ActionForm>
          )}
          {run && <a className="btn-secondary" href={`/payroll/${month}/csv`}>Download Excel (CSV)</a>}
        </div>
      </div>

      {run && (
        <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
          <div className="card"><div className="muted">{L.gross}</div><div className="text-xl font-bold">{formatRs(sum("gross"))}</div></div>
          <div className="card"><div className="muted">PF + ESIC (employee)</div><div className="text-xl font-bold">{formatRs(sum("pfEmployee") + sum("esiEmployee"))}</div></div>
          <div className="card"><div className="muted">Advance recovered</div><div className="text-xl font-bold">{formatRs(sum("advanceRecovered"))}</div></div>
          <div className="card"><div className="muted">Net to pay</div><div className="text-xl font-bold">{formatRs(sum("net"))}</div></div>
        </div>
      )}

      {run && (
        <div className="card overflow-x-auto !p-0">
          <table className="table table-cards">
            <thead>
              <tr>
                <th>Employee</th><th>{L.rate}</th><th>{L.days}</th><th>{L.gross}</th><th>{L.adj}</th><th>PF</th><th>ESIC</th><th>{L.adv}</th><th>{L.net}</th><th>{L.paid}</th><th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="card-title font-medium"><Link className="font-medium hover:underline" href={`/employees/${l.employeeId}`}>{l.employee.name}</Link>{l.employee.holdSalary && <span className="badge badge-amber ml-1">On hold</span>}</td>
                  <td data-label={L.rate} className="whitespace-nowrap">{formatRs(l.rate)}{l.wageType === "MONTHLY" ? "/m" : "/d"}</td>
                  <td data-label={L.days}>{l.payableDays}{l.wageType === "MONTHLY" ? ` / ${l.daysInMonth}` : ""}</td>
                  <td data-label={L.gross}>{formatRs(l.gross)}</td>
                  <td data-label={L.adj}>{l.adjustments ? formatRs(l.adjustments) : "—"}</td>
                  <td data-label="PF">{l.pfEmployee ? formatRs(l.pfEmployee) : "—"}</td>
                  <td data-label="ESIC">{l.esiEmployee ? formatRs(l.esiEmployee) : "—"}</td>
                  <td data-label={L.adv}>{l.advanceRecovered ? formatRs(l.advanceRecovered) : "—"}</td>
                  <td data-label={L.net} className={`font-semibold ${l.net < 0 ? "text-[var(--red)]" : ""}`}>{formatRs(l.net)}</td>
                  <td data-label={L.paid}>
                    <span>
                      {l.paidAmount ? `${formatRs(l.paidAmount)} ${l.paymentMode ?? ""}` : "—"}
                      {locked && can(actor, "payroll.lock") && (
                        <details className="text-left">
                          <summary className="cursor-pointer text-xs text-[var(--brand)]">{l.paidAmount ? "Edit" : "Record payment"}</summary>
                          <ActionForm action={recordPayment} className="mt-2 flex min-w-[14rem] flex-col gap-2" submitLabel={"Save"}>
                            <input type="hidden" name="lineId" value={l.id} />
                            <input name="amount" className="input" defaultValue={rsInput(l.paidAmount || Math.max(0, l.net))} inputMode="decimal" />
                            <Select
                              name="mode"
                              defaultValue={l.paymentMode ?? "CASH"}
                              ariaLabel="Payment mode"
                              options={[{ value: "CASH", label: "Cash" }, { value: "BANK", label: "Bank transfer" }, { value: "UPI", label: "UPI" }, { value: "CHEQUE", label: "Cheque" }]}
                            />
                            <DateInput name="paidOn" defaultValue={istDateKey(new Date())} />
                            <input name="ref" className="input" placeholder={"Reference (optional)"} defaultValue={l.paymentRef ?? ""} />
                          </ActionForm>
                        </details>
                      )}
                    </span>
                  </td>
                  <td><Link className="link" href={`/payslip/${l.id}`}>Payslip</Link></td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={11} className="muted">No employees in this month.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {run && (sum("pfEmployer") > 0 || sum("esiEmployer") > 0) && (
        <p className="muted">
          {"Employer share (not deducted from salary):"} PF {formatRs(sum("pfEmployer"))}, ESIC {formatRs(sum("esiEmployer"))}.
        </p>
      )}

      {can(actor, "payroll.run") && (
        <section className="card">
          <h2 className="mb-1 font-semibold">{"Adjustments for"} {formatMonth(month)}</h2>
          <p className="muted mb-3">
            {"One-off extra payment or deduction, for example a bonus, or a fix for a month that was already locked."}
          </p>
          {!locked ? (
            <ActionForm action={addAdjustment} className="grid gap-3 @2xl:grid-cols-5" submitLabel={"Add"} resetOnSuccess>
              <input type="hidden" name="month" value={month} />
              <Select name="employeeId" className="@2xl:col-span-2" defaultValue="" ariaLabel="Employee" options={[{ value: "", label: "Choose employee" }, ...employees.map((e) => ({ value: e.id, label: `${e.name} (${e.code})` }))]} />
              <Select name="kind" ariaLabel="Add or deduct" options={[{ value: "add", label: "Add (+)" }, { value: "deduct", label: "Deduct (−)" }]} />
              <input name="amount" className="input" placeholder={"Amount ₹"} inputMode="decimal" required />
              <input name="reason" className="input" placeholder={"Reason"} required />
            </ActionForm>
          ) : (
            <p className="text-sm">
              {"This month is locked. Add adjustments to"}{" "}
              <Link className="underline" href={`/payroll/${addMonths(month, 1)}`}>{formatMonth(addMonths(month, 1))}</Link>
            </p>
          )}
          {adjustments.length > 0 && (
            <table className="table table-cards mt-3">
              <thead><tr><th>Employee</th><th>Amount</th><th>Reason</th></tr></thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id}>
                    <td className="card-title">{a.employee.name}</td>
                    <td data-label={"Amount"}>{formatRs(a.amount)}</td>
                    <td data-label={"Reason"}>{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
