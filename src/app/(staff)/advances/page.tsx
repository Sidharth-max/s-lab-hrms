import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { formatRs } from "@/lib/money";
import { employeeScope } from "@/lib/scope";
import { recoveredByAdvance } from "@/lib/services";
import { dbToDateKey, formatDateKey, formatMonth } from "@/lib/time";

export default async function AdvancesPage({ searchParams }: PageProps<"/advances">) {
  const actor = await requireStaff();
  const { t } = await getT();
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
  const STATUS: Record<string, string> = {
    PENDING_APPROVAL: t("Waiting approval", "मंज़ूरी बाकी"),
    ACTIVE: t("Recovering", "वसूली चालू"),
    CLEARED: t("Cleared", "चुकता"),
    REJECTED: t("Rejected", "नामंज़ूर"),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="h1">{t("Advances", "एडवांस")}</h1>
          <p className="muted">
            {t("Total still to recover:", "कुल वसूली बाकी:")} <b>{formatRs(total)}</b>. {t("To give an advance, open the employee.", "एडवांस देने के लिए कर्मचारी खोलें।")}
          </p>
        </div>
        <Link href={all ? "/advances" : "/advances?all=1"} className="btn-secondary">
          {all ? t("Show open only", "सिर्फ़ बाकी वाले") : t("Show all (incl. cleared)", "सभी दिखाएं (चुकता भी)")}
        </Link>
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr>
              <th>{t("Employee", "कर्मचारी")}</th><th>{t("Given", "दिया")}</th><th>{t("Amount", "रकम")}</th><th>{t("Recovered", "वसूला")}</th>
              <th>{t("Left", "बाकी")}</th><th>{t("Plan", "योजना")}</th><th>{t("Status", "स्थिति")}</th>
            </tr>
          </thead>
          <tbody>
            {advances.map((a) => {
              const r = rec.get(a.id) ?? 0;
              return (
                <tr key={a.id}>
                  <td className="card-title"><Link className="text-[var(--brand)]" href={`/employees/${a.employeeId}?advance=1`}>{a.employee.name}</Link></td>
                  <td data-label={t("Given", "दिया")}>{formatDateKey(dbToDateKey(a.givenOn))}</td>
                  <td data-label={t("Amount", "रकम")}>{formatRs(a.amount)}</td>
                  <td data-label={t("Recovered", "वसूला")}>{formatRs(r)}</td>
                  <td data-label={t("Left", "बाकी")} className="font-semibold">{formatRs(a.status === "REJECTED" ? 0 : a.amount - r)}</td>
                  <td data-label={t("Plan", "योजना")}>{a.recoveryMonths === 1 ? t("Full", "पूरा") : t(`${a.recoveryMonths} months`, `${a.recoveryMonths} महीने`)} {t("from", "से")} {formatMonth(a.startMonth)}</td>
                  <td data-label={t("Status", "स्थिति")}>{STATUS[a.status]}</td>
                </tr>
              );
            })}
            {advances.length === 0 && <tr><td colSpan={7} className="muted">{t("No advances.", "कोई एडवांस नहीं।")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
