import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { formatRs } from "@/lib/money";
import { addMonths, formatMonth, isMonthKey, istMonthKey } from "@/lib/time";

export default async function PayrollList({ searchParams }: PageProps<"/payroll">) {
  const actor = await requireStaff();
  const { t } = await getT();
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
      <h1 className="h1">{t("Salary", "सैलरी")}</h1>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((m) => <Link key={m} href={`/payroll/${m}`} className="btn-primary">{t("Prepare", "बनाएं")} {formatMonth(m)}</Link>)}
        <form className="flex gap-2">
          <input type="month" name="month" max={current} className="input" />
          <button className="btn-secondary">{t("Open month", "महीना खोलें")}</button>
        </form>
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr><th>{t("Month", "महीना")}</th><th>{t("Status", "स्थिति")}</th><th>{t("Employees", "कर्मचारी")}</th><th>{t("Net salary", "कुल देय")}</th><th>{t("Paid", "दिया")}</th></tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="card-title"><Link className="font-medium text-[var(--brand)]" href={`/payroll/${r.month}`}>{formatMonth(r.month)}</Link></td>
                <td data-label={t("Status", "स्थिति")}>
                  {r.status === "LOCKED" ? <span className="badge bg-green-100 text-green-800">{t("Locked", "लॉक")}</span> : <span className="badge bg-gray-100">{t("Draft", "ड्राफ़्ट")}</span>}
                </td>
                <td data-label={t("Employees", "कर्मचारी")}>{r.lines.length}</td>
                <td data-label={t("Net salary", "कुल देय")}>{formatRs(r.lines.reduce((s, l) => s + l.net, 0))}</td>
                <td data-label={t("Paid", "दिया")}>{formatRs(r.lines.reduce((s, l) => s + l.paidAmount, 0))}</td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={5} className="muted">{t("No salary prepared yet.", "अभी सैलरी नहीं बनी।")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
