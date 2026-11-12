import type { Business, Employee, PayrollLine, PayrollRun, Site } from "@prisma/client";
import { formatRs } from "@/lib/money";
import { formatMonth } from "@/lib/time";
import { PrintButton } from "./PrintButton";
import { getT } from "@/lib/i18n-server";

export async function Payslip({
  line,
  business,
}: {
  line: PayrollLine & { run: PayrollRun; employee: Employee & { site: Site } };
  business: Business;
}) {
  const { t } = await getT();
  const e = line.employee;
  const deductions = [
    [t("PF (employee)", "PF (कर्मचारी)"), line.pfEmployee],
    [t("ESIC (employee)", "ESIC (कर्मचारी)"), line.esiEmployee],
    [t("Advance recovered", "एडवांस वसूली"), line.advanceRecovered],
    ...(line.adjustments < 0 ? [[t("Other deduction", "अन्य कटौती"), -line.adjustments] as [string, number]] : []),
  ].filter(([, v]) => (v as number) > 0) as [string, number][];
  const earnings: [string, number][] = [
    [
      line.wageType === "MONTHLY"
        ? t(`Salary (${line.payableDays} of ${line.daysInMonth} days)`, `सैलरी (${line.daysInMonth} में से ${line.payableDays} दिन)`)
        : t(`Wages (${line.payableDays} days × ${formatRs(line.rate)})`, `दिहाड़ी (${line.payableDays} दिन × ${formatRs(line.rate)})`),
      line.gross,
    ],
    ...(line.adjustments > 0 ? [[t("Extra payment", "अतिरिक्त भुगतान"), line.adjustments] as [string, number]] : []),
  ];

  return (
    <div className="@container mx-auto flex max-w-2xl flex-col gap-4">
      <div className="no-print flex justify-end"><PrintButton /></div>
      <div className="card flex flex-col gap-4 print:border-0">
        <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] pb-3">
          <div>
            <div className="text-xl font-bold">{business.name}</div>
            <div className="muted">{t("Payslip", "सैलरी स्लिप")} · {formatMonth(line.run.month)}</div>
          </div>
          {line.run.status === "DRAFT" && <span className="badge bg-amber-100 text-amber-800">{t("DRAFT, not final", "ड्राफ़्ट, अंतिम नहीं")}</span>}
        </div>
        <div className="grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-2">
          <div><span className="muted">{t("Name", "नाम")}:</span> {e.name}</div>
          <div><span className="muted">{t("Code", "कोड")}:</span> {e.code}</div>
          <div><span className="muted">{t("Site", "साइट")}:</span> {e.site.name}</div>
          <div><span className="muted">{t("Pay type", "वेतन प्रकार")}:</span> {line.wageType === "MONTHLY" ? t("Monthly", "महीना") : t("Daily", "रोज़")} {formatRs(line.rate)}</div>
          <div><span className="muted">{t("Days present", "हाज़िर दिन")}:</span> {line.presentDays}</div>
          <div><span className="muted">{t("Payable days", "भुगतान वाले दिन")}:</span> {line.payableDays}</div>
        </div>
        <div className="grid gap-4 @xl:grid-cols-2">
          <table className="table">
            <thead><tr><th>{t("Earnings", "कमाई")}</th><th className="text-right">₹</th></tr></thead>
            <tbody>
              {earnings.map(([k, v]) => <tr key={k}><td>{k}</td><td className="text-right">{formatRs(v)}</td></tr>)}
            </tbody>
          </table>
          <table className="table">
            <thead><tr><th>{t("Deductions", "कटौती")}</th><th className="text-right">₹</th></tr></thead>
            <tbody>
              {deductions.map(([k, v]) => <tr key={k}><td>{k}</td><td className="text-right">{formatRs(v)}</td></tr>)}
              {deductions.length === 0 && <tr><td colSpan={2} className="muted">{t("None", "कोई नहीं")}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
          <span className="font-semibold">{t("Net pay", "हाथ में सैलरी")}</span>
          <span className="text-2xl font-bold">{formatRs(line.net)}</span>
        </div>
        {(line.pfEmployer > 0 || line.esiEmployer > 0) && (
          <p className="muted">{t("Employer contribution (paid by company, not deducted):", "कंपनी का योगदान (कंपनी देती है, कटता नहीं):")} PF {formatRs(line.pfEmployer)}, ESIC {formatRs(line.esiEmployer)}</p>
        )}
        {line.paidAmount > 0 && (
          <p className="text-sm">
            {t("Paid", "दिया")} {formatRs(line.paidAmount)} · {line.paymentMode} · {line.paidOn?.toISOString().slice(0, 10)}
            {line.paymentRef ? ` (ref ${line.paymentRef})` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
