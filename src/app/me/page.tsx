import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Tabs } from "@/components/Tabs";
import { getActor } from "@/lib/auth";
import { countDays, STATUS_SHORT } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { formatRs } from "@/lib/money";
import { monthAttendance, outstandingAdvances } from "@/lib/services";
import { dbToDateKey, formatDateKey, formatMonth, istMonthKey } from "@/lib/time";

// Employee portal: view only.
export default async function MePage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "EMPLOYEE") redirect("/dashboard");
  const { t } = await getT();
  const emp = await db.employee.findUnique({ where: { userId: actor.id }, include: { business: true, site: true } });
  if (!emp) redirect("/login");
  const month = istMonthKey(new Date());
  const [{ days }, advances, lines] = await Promise.all([
    monthAttendance(emp.businessId, month, [emp]),
    outstandingAdvances(emp.id),
    db.payrollLine.findMany({ where: { employeeId: emp.id, run: { status: "LOCKED" } }, include: { run: true }, orderBy: { run: { month: "desc" } }, take: 24 }),
  ]);
  const list = days.get(emp.id)!;
  const c = countDays(list);
  const open = advances.filter((a) => a.remaining > 0);

  const salary = (
    <section className="card">
      <h2 className="mb-2 font-semibold">{t("My salary", "मेरी सैलरी")}</h2>
      <div className="grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-2">
        <div><span className="muted">{t("Type", "प्रकार")}:</span> {emp.wageType === "MONTHLY" ? t("Monthly", "महीना") : t("Daily", "रोज़")}</div>
        <div>
          <span className="muted">{t("Rate", "दर")}:</span> {formatRs(emp.wageType === "MONTHLY" ? emp.monthlyWage : emp.dailyWage)}
          {emp.wageType === "MONTHLY" ? t(" / month", " / महीना") : t(" / day", " / दिन")}
        </div>
        <div><span className="muted">PF:</span> {emp.pfEnabled ? t("Yes", "हाँ") : t("No", "नहीं")}</div>
        <div><span className="muted">ESIC:</span> {emp.esiEnabled ? t("Yes", "हाँ") : t("No", "नहीं")}</div>
        <div><span className="muted">{t("Joined", "जॉइन किया")}:</span> {formatDateKey(dbToDateKey(emp.joinedOn))}</div>
      </div>
    </section>
  );
  const attendance = (
    <section className="card">
      <h2 className="mb-2 font-semibold">{t("Attendance", "हाज़िरी")} · {formatMonth(month)}</h2>
      <p className="mb-2 text-sm">
        {t("Present", "हाज़िर")} {c.present} · {t("Absent", "ग़ैरहाज़िर")} {c.absent} · {t("Leave", "छुट्टी")} {c.paidLeave + c.unpaidLeave}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {list.map((d) => (
          <div key={d.date} className="rounded border border-[var(--line)] p-1">
            <div className="muted">{Number(d.date.slice(8))}</div>
            <div className="font-semibold">{STATUS_SHORT[d.status] || "·"}</div>
          </div>
        ))}
      </div>
    </section>
  );
  const advance = (
    <section className="card">
      <h2 className="mb-2 font-semibold">{t("Advance", "एडवांस")}</h2>
      {open.length === 0 ? <p className="muted">{t("No advance to repay.", "कोई एडवांस बाकी नहीं।")}</p> : (
        <table className="table table-cards">
          <thead><tr><th>{t("Given", "दिया")}</th><th>{t("Amount", "रकम")}</th><th>{t("Left to repay", "चुकाना बाकी")}</th></tr></thead>
          <tbody>
            {open.map((a) => (
              <tr key={a.id}>
                <td data-label={t("Given", "दिया")}>{formatDateKey(dbToDateKey(a.givenOn))}</td>
                <td data-label={t("Amount", "रकम")}>{formatRs(a.amount)}</td>
                <td data-label={t("Left to repay", "चुकाना बाकी")} className="font-semibold">{formatRs(a.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
  const payslips = (
    <section className="card">
      <h2 className="mb-2 font-semibold">{t("Payslips", "सैलरी स्लिप")}</h2>
      {lines.length === 0 ? <p className="muted">{t("No payslips yet.", "अभी कोई सैलरी स्लिप नहीं।")}</p> : (
        <ul className="flex flex-col gap-1">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between">
              <Link className="text-[var(--brand)] underline" href={`/me/payslip/${l.id}`}>{formatMonth(l.run.month)}</Link>
              <span className="font-semibold">{formatRs(l.net)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <main className="cq mx-auto flex max-w-4xl flex-col gap-4 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold">{emp.business.name}</div>
          <div className="muted">{emp.name} · {emp.code} · {emp.site.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <form action={logout}><button className="btn-secondary">{t("Log out", "लॉग आउट")}</button></form>
        </div>
      </header>
      <Tabs
        tabs={[
          { id: "salary", label: t("Salary", "सैलरी"), content: salary },
          { id: "attendance", label: t("Attendance", "हाज़िरी"), content: attendance },
          { id: "advance", label: t("Advance", "एडवांस"), content: advance },
          { id: "payslips", label: t("Payslips", "सैलरी स्लिप"), content: payslips },
        ]}
      />
    </main>
  );
}
