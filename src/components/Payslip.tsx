import type { Business, Employee, PayrollLine, PayrollRun, Site } from "@prisma/client";
import { formatRs } from "@/lib/money";
import { formatMonth } from "@/lib/time";
import { PrintButton } from "./PrintButton";

export async function Payslip({
  line,
  business,
}: {
  line: PayrollLine & { run: PayrollRun; employee: Employee & { site: Site } };
  business: Business;
}) {
  const e = line.employee;
  const deductions = [
    ["PF (employee)", line.pfEmployee],
    ["ESIC (employee)", line.esiEmployee],
    ["Advance recovered", line.advanceRecovered],
    ...(line.adjustments < 0 ? [["Other deduction", -line.adjustments] as [string, number]] : []),
  ].filter(([, v]) => (v as number) > 0) as [string, number][];
  const earnings: [string, number][] = [
    [
      line.wageType === "MONTHLY"
        ? `Salary (${line.payableDays} of ${line.daysInMonth} days)`
        : `Wages (${line.payableDays} days × ${formatRs(line.rate)})`,
      line.gross,
    ],
    ...(line.adjustments > 0 ? [["Extra payment", line.adjustments] as [string, number]] : []),
  ];

  return (
    <div className="@container mx-auto flex max-w-2xl flex-col gap-4">
      <div className="no-print flex justify-end"><PrintButton /></div>
      <div className="card flex flex-col gap-4 print:border-0">
        <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] pb-3">
          <div>
            <div className="text-xl font-bold">{business.name}</div>
            <div className="muted">{"Payslip"} · {formatMonth(line.run.month)}</div>
          </div>
          {line.run.status === "DRAFT" && <span className="badge badge-neutral">DRAFT, not final</span>}
        </div>
        <div className="grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-2">
          <div><span className="muted">{"Name"}:</span> {e.name}</div>
          <div><span className="muted">{"Code"}:</span> {e.code}</div>
          <div><span className="muted">{"Site"}:</span> {e.site.name}</div>
          <div><span className="muted">{"Pay type"}:</span> {line.wageType === "MONTHLY" ? "Monthly" : "Daily"} {formatRs(line.rate)}</div>
          <div><span className="muted">{"Days present"}:</span> {line.presentDays}</div>
          <div><span className="muted">{"Payable days"}:</span> {line.payableDays}</div>
        </div>
        <div className="grid gap-4 @xl:grid-cols-2">
          <table className="table">
            <thead><tr><th>Earnings</th><th className="text-right">₹</th></tr></thead>
            <tbody>
              {earnings.map(([k, v]) => <tr key={k}><td>{k}</td><td className="text-right">{formatRs(v)}</td></tr>)}
            </tbody>
          </table>
          <table className="table">
            <thead><tr><th>Deductions</th><th className="text-right">₹</th></tr></thead>
            <tbody>
              {deductions.map(([k, v]) => <tr key={k}><td>{k}</td><td className="text-right">{formatRs(v)}</td></tr>)}
              {deductions.length === 0 && <tr><td colSpan={2} className="muted">None</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
          <span className="font-semibold">Net pay</span>
          <span className="text-2xl font-bold">{formatRs(line.net)}</span>
        </div>
        {(line.pfEmployer > 0 || line.esiEmployer > 0) && (
          <p className="muted">{"Employer contribution (paid by company, not deducted):"} PF {formatRs(line.pfEmployer)}, ESIC {formatRs(line.esiEmployer)}</p>
        )}
        {line.paidAmount > 0 && (
          <p className="text-sm">
            {"Paid"} {formatRs(line.paidAmount)} · {line.paymentMode} · {line.paidOn?.toISOString().slice(0, 10)}
            {line.paymentRef ? ` (ref ${line.paymentRef})` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
