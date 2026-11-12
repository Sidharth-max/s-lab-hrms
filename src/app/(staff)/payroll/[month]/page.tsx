import Link from "next/link";
import { notFound } from "next/navigation";
import { addAdjustment, lockPayrollAction, recalcPayroll, recordPayment, reopenPayrollAction } from "@/app/actions/payroll";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { formatRs, rsInput } from "@/lib/money";
import { can } from "@/lib/permissions";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere } from "@/lib/services";
import { addMonths, formatMonth, isMonthKey, istDateKey, istMonthKey } from "@/lib/time";

export default async function PayrollMonth({ params }: PageProps<"/payroll/[month]">) {
  const actor = await requireStaff();
  const { t } = await getT();
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
    rate: t("Rate", "दर"),
    days: t("Days", "दिन"),
    gross: t("Gross", "कुल"),
    adj: t("Adjustment", "एडजस्टमेंट"),
    adv: t("Advance", "एडवांस"),
    net: t("Net", "हाथ में"),
    paid: t("Paid", "दिया"),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/payroll" className="muted underline">← {t("Salary", "सैलरी")}</Link>
          <h1 className="h1">
            {t("Salary", "सैलरी")} · {formatMonth(month)}{" "}
            {run && (locked ? <span className="badge bg-green-100 align-middle text-green-800">{t("Locked", "लॉक")}</span> : <span className="badge bg-gray-100 align-middle">{t("Draft", "ड्राफ़्ट")}</span>)}
          </h1>
          {run && !locked && (
            <p className="muted">
              {t(`Last calculated ${when(run.updatedAt)}. Recalculate after attendance or advance changes.`, `आख़िरी बार ${when(run.updatedAt)} को बनी। हाज़िरी या एडवांस बदलने के बाद फिर से गिनें।`)}
            </p>
          )}
          {locked && run.lockedAt && <p className="muted">{t("Locked", "लॉक")} {when(run.lockedAt)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!locked && can(actor, "payroll.run") && (
            <ActionForm action={recalcPayroll} submitLabel={run ? t("Recalculate", "फिर से गिनें") : t("Calculate salary", "सैलरी गिनें")} submitClass={run ? "btn-secondary" : "btn-primary"}>
              <input type="hidden" name="month" value={month} />
            </ActionForm>
          )}
          {run && !locked && can(actor, "payroll.lock") && (
            <ActionForm
              action={lockPayrollAction}
              submitLabel={t("Approve and lock", "मंज़ूर करके लॉक करें")}
              confirm={
                (isCurrent ? t("This month is not over yet. ", "यह महीना अभी ख़त्म नहीं हुआ। ") : "") +
                t(`Lock salary for ${formatMonth(month)}? Attendance for this month can then no longer be edited.`, `${formatMonth(month)} की सैलरी लॉक करें? फिर इस महीने की हाज़िरी नहीं बदल सकेंगे।`)
              }
            >
              <input type="hidden" name="month" value={month} />
            </ActionForm>
          )}
          {locked && actor.role === "OWNER" && (
            <ActionForm action={reopenPayrollAction} submitLabel={t("Reopen (owner)", "फिर से खोलें (मालिक)")} submitClass="btn-secondary" confirm={t("Reopen this locked month?", "यह लॉक महीना फिर से खोलें?")}>
              <input type="hidden" name="month" value={month} />
            </ActionForm>
          )}
          {run && <a className="btn-secondary" href={`/payroll/${month}/csv`}>{t("Download Excel (CSV)", "एक्सेल डाउनलोड (CSV)")}</a>}
        </div>
      </div>

      {run && (
        <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
          <div className="card"><div className="muted">{L.gross}</div><div className="text-xl font-bold">{formatRs(sum("gross"))}</div></div>
          <div className="card"><div className="muted">{t("PF + ESIC (employee)", "PF + ESIC (कर्मचारी)")}</div><div className="text-xl font-bold">{formatRs(sum("pfEmployee") + sum("esiEmployee"))}</div></div>
          <div className="card"><div className="muted">{t("Advance recovered", "एडवांस वसूली")}</div><div className="text-xl font-bold">{formatRs(sum("advanceRecovered"))}</div></div>
          <div className="card"><div className="muted">{t("Net to pay", "कुल देना है")}</div><div className="text-xl font-bold">{formatRs(sum("net"))}</div></div>
        </div>
      )}

      {run && (
        <div className="card overflow-x-auto !p-0">
          <table className="table table-cards">
            <thead>
              <tr>
                <th>{t("Employee", "कर्मचारी")}</th><th>{L.rate}</th><th>{L.days}</th><th>{L.gross}</th><th>{L.adj}</th><th>PF</th><th>ESIC</th><th>{L.adv}</th><th>{L.net}</th><th>{L.paid}</th><th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="card-title font-medium"><Link className="text-[var(--brand)]" href={`/employees/${l.employeeId}`}>{l.employee.name}</Link></td>
                  <td data-label={L.rate} className="whitespace-nowrap">{formatRs(l.rate)}{l.wageType === "MONTHLY" ? t("/m", "/महीना") : t("/d", "/दिन")}</td>
                  <td data-label={L.days}>{l.payableDays}{l.wageType === "MONTHLY" ? ` / ${l.daysInMonth}` : ""}</td>
                  <td data-label={L.gross}>{formatRs(l.gross)}</td>
                  <td data-label={L.adj}>{l.adjustments ? formatRs(l.adjustments) : "—"}</td>
                  <td data-label="PF">{l.pfEmployee ? formatRs(l.pfEmployee) : "—"}</td>
                  <td data-label="ESIC">{l.esiEmployee ? formatRs(l.esiEmployee) : "—"}</td>
                  <td data-label={L.adv}>{l.advanceRecovered ? formatRs(l.advanceRecovered) : "—"}</td>
                  <td data-label={L.net} className={`font-semibold ${l.net < 0 ? "text-red-600" : ""}`}>{formatRs(l.net)}</td>
                  <td data-label={L.paid}>
                    <span>
                      {l.paidAmount ? `${formatRs(l.paidAmount)} ${l.paymentMode ?? ""}` : "—"}
                      {locked && can(actor, "payroll.lock") && (
                        <details className="text-left">
                          <summary className="cursor-pointer text-xs text-[var(--brand)]">{l.paidAmount ? t("Edit", "बदलें") : t("Record payment", "भुगतान दर्ज करें")}</summary>
                          <ActionForm action={recordPayment} className="mt-2 flex min-w-[14rem] flex-col gap-2" submitLabel={t("Save", "सेव करें")}>
                            <input type="hidden" name="lineId" value={l.id} />
                            <input name="amount" className="input" defaultValue={rsInput(l.paidAmount || Math.max(0, l.net))} inputMode="decimal" />
                            <select name="mode" className="input" defaultValue={l.paymentMode ?? "CASH"}>
                              <option value="CASH">{t("Cash", "नकद")}</option>
                              <option value="BANK">{t("Bank transfer", "बैंक ट्रांसफ़र")}</option>
                              <option value="UPI">UPI</option>
                              <option value="CHEQUE">{t("Cheque", "चेक")}</option>
                            </select>
                            <input type="date" name="paidOn" className="input" defaultValue={istDateKey(new Date())} />
                            <input name="ref" className="input" placeholder={t("Reference (optional)", "रेफ़रेंस (ज़रूरी नहीं)")} defaultValue={l.paymentRef ?? ""} />
                          </ActionForm>
                        </details>
                      )}
                    </span>
                  </td>
                  <td><Link className="text-[var(--brand)] underline" href={`/payslip/${l.id}`}>{t("Payslip", "सैलरी स्लिप")}</Link></td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={11} className="muted">{t("No employees in this month.", "इस महीने कोई कर्मचारी नहीं।")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {run && (sum("pfEmployer") > 0 || sum("esiEmployer") > 0) && (
        <p className="muted">
          {t("Employer share (not deducted from salary):", "कंपनी का हिस्सा (सैलरी से नहीं कटता):")} PF {formatRs(sum("pfEmployer"))}, ESIC {formatRs(sum("esiEmployer"))}.
        </p>
      )}

      {can(actor, "payroll.run") && (
        <section className="card">
          <h2 className="mb-1 font-semibold">{t("Adjustments for", "एडजस्टमेंट:")} {formatMonth(month)}</h2>
          <p className="muted mb-3">
            {t("One-off extra payment or deduction, for example a bonus, or a fix for a month that was already locked.", "एक बार का अतिरिक्त भुगतान या कटौती, जैसे बोनस, या लॉक हो चुके महीने का सुधार।")}
          </p>
          {!locked ? (
            <ActionForm action={addAdjustment} className="grid gap-3 @2xl:grid-cols-5" submitLabel={t("Add", "जोड़ें")} resetOnSuccess>
              <input type="hidden" name="month" value={month} />
              <select name="employeeId" className="input @2xl:col-span-2" required>
                <option value="">{t("Choose employee", "कर्मचारी चुनें")}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
              </select>
              <select name="kind" className="input"><option value="add">{t("Add (+)", "जोड़ें (+)")}</option><option value="deduct">{t("Deduct (−)", "काटें (−)")}</option></select>
              <input name="amount" className="input" placeholder={t("Amount ₹", "रकम ₹")} inputMode="decimal" required />
              <input name="reason" className="input" placeholder={t("Reason", "कारण")} required />
            </ActionForm>
          ) : (
            <p className="text-sm">
              {t("This month is locked. Add adjustments to", "यह महीना लॉक है। एडजस्टमेंट जोड़ें:")}{" "}
              <Link className="underline" href={`/payroll/${addMonths(month, 1)}`}>{formatMonth(addMonths(month, 1))}</Link>
            </p>
          )}
          {adjustments.length > 0 && (
            <table className="table table-cards mt-3">
              <thead><tr><th>{t("Employee", "कर्मचारी")}</th><th>{t("Amount", "रकम")}</th><th>{t("Reason", "कारण")}</th></tr></thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id}>
                    <td className="card-title">{a.employee.name}</td>
                    <td data-label={t("Amount", "रकम")}>{formatRs(a.amount)}</td>
                    <td data-label={t("Reason", "कारण")}>{a.reason}</td>
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
