import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { statusLabel } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere, monthAttendance } from "@/lib/services";
import { formatDateKey, formatIstTime, istDateKey } from "@/lib/time";

function minsToText(m: number) {
  return m ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : "—";
}

export default async function AttendanceDay({ searchParams }: PageProps<"/attendance">) {
  const actor = await requireStaff();
  const { t, lang } = await getT();
  const sp = await searchParams;
  const today = istDateKey(new Date());
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const employees = await db.employee.findMany({
    where: { ...employeeScope(actor), ...employedInMonthWhere(actor.businessId, date.slice(0, 7)) },
    include: { site: true },
    orderBy: { name: "asc" },
  });
  const { days } = await monthAttendance(actor.businessId, date.slice(0, 7), employees);
  const rows = employees
    .map((e) => ({ e, d: days.get(e.id)!.find((x) => x.date === date)! }))
    .filter((r) => r.d.status !== "NOT_EMPLOYED");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="h1">{t("Attendance", "हाज़िरी")} · {formatDateKey(date)}</h1>
        <div className="flex flex-wrap gap-2">
          <form className="flex gap-2">
            <input type="date" name="date" defaultValue={date} max={today} className="input" />
            <button className="btn-secondary">{t("Go", "देखें")}</button>
          </form>
          <Link href={`/attendance/register?month=${date.slice(0, 7)}`} className="btn-secondary">{t("Monthly register", "महीने का रजिस्टर")}</Link>
        </div>
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr>
              <th>{t("Employee", "कर्मचारी")}</th><th>{t("Site", "साइट")}</th><th>{t("Status", "स्थिति")}</th>
              <th>{t("In", "आए")}</th><th>{t("Out", "गए")}</th><th>{t("Worked", "काम किया")}</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, d }) => (
              <tr key={e.id}>
                <td className="card-title font-medium">{e.name} <span className="muted">{e.code}</span></td>
                <td data-label={t("Site", "साइट")}>{e.site.name}</td>
                <td data-label={t("Status", "स्थिति")}>
                  <span>
                    {statusLabel(d.status, lang)}
                    {d.overridden && <span className="badge ml-1 bg-blue-50 text-[var(--brand)]">{t("manual", "हाथ से")}</span>}
                    {d.missingOut && !d.overridden && <span className="badge ml-1 bg-amber-100 text-amber-800">{t("no out punch", "जाने का पंच नहीं")}</span>}
                  </span>
                </td>
                <td data-label={t("In", "आए")}>{d.inAt ? formatIstTime(d.inAt) : "—"}</td>
                <td data-label={t("Out", "गए")}>{d.outAt ? formatIstTime(d.outAt) : "—"}</td>
                <td data-label={t("Worked", "काम किया")}>{minsToText(d.workedMins)}</td>
                <td><Link className="text-[var(--brand)] underline" href={`/attendance/${e.id}/${date}`}>{t("Details / edit", "विवरण / बदलें")}</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">{t("No employees for this date.", "इस तारीख़ के लिए कोई कर्मचारी नहीं।")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
