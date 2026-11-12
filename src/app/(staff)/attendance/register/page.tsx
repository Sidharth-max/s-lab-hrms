import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { countDays, STATUS_SHORT, type DerivedStatus } from "@/lib/attendance";
import { db } from "@/lib/db";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere, monthAttendance } from "@/lib/services";
import { addMonths, formatMonth, isMonthKey, istMonthKey, monthDates } from "@/lib/time";
import { getT } from "@/lib/i18n-server";

const COLOR: Partial<Record<DerivedStatus, string>> = {
  PRESENT: "bg-green-100 text-green-900",
  HALF_DAY: "bg-lime-100 text-lime-900",
  ABSENT: "bg-red-100 text-red-900",
  PAID_LEAVE: "bg-blue-100 text-blue-900",
  UNPAID_LEAVE: "bg-orange-100 text-orange-900",
  WEEKLY_OFF: "bg-gray-100 text-gray-600",
  HOLIDAY: "bg-purple-100 text-purple-900",
};

export default async function Register({ searchParams }: PageProps<"/attendance/register">) {
  const actor = await requireStaff();
  const { t } = await getT();
  const sp = await searchParams;
  const current = istMonthKey(new Date());
  const month = typeof sp.month === "string" && isMonthKey(sp.month) && sp.month <= current ? sp.month : current;
  const only = typeof sp.employee === "string" ? sp.employee : undefined;
  const employees = await db.employee.findMany({
    where: { ...employeeScope(actor), ...employedInMonthWhere(actor.businessId, month), ...(only ? { id: only } : {}) },
    orderBy: { name: "asc" },
  });
  const { days } = await monthAttendance(actor.businessId, month, employees);
  const dates = monthDates(month);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">{t("Register", "रजिस्टर")} · {formatMonth(month)}</h1>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`?month=${addMonths(month, -1)}${only ? `&employee=${only}` : ""}`}>← {t("Prev", "पिछला")}</Link>
          {month < current && <Link className="btn-secondary" href={`?month=${addMonths(month, 1)}${only ? `&employee=${only}` : ""}`}>{t("Next", "अगला")} →</Link>}
          {only && <Link className="btn-secondary" href={`?month=${month}`}>{t("All employees", "सभी कर्मचारी")}</Link>}
        </div>
      </div>
      <p className="muted">{t("P present · H half day · A absent · PL paid leave · UL unpaid leave · WO weekly off · HO holiday · * edited · ! no out punch. Tap a day to edit.", "P हाज़िर · H आधा दिन · A ग़ैरहाज़िर · PL सवेतन छुट्टी · UL बिना वेतन छुट्टी · WO साप्ताहिक छुट्टी · HO त्योहार · * बदला गया · ! जाने का पंच नहीं। बदलने के लिए दिन पर टैप करें।")}</p>
      <div className="card overflow-x-auto !p-0">
        <table className="table text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white">{t("Employee", "कर्मचारी")}</th>
              {dates.map((d) => <th key={d} className="!px-1 text-center">{Number(d.slice(8))}</th>)}
              <th>{t("Present", "हाज़िर")}</th><th>{t("Absent", "ग़ैरहाज़िर")}</th><th>{t("Leave", "छुट्टी")}</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const list = days.get(e.id)!;
              const c = countDays(list);
              return (
                <tr key={e.id}>
                  <td className="sticky left-0 bg-white font-medium whitespace-nowrap">{e.name}</td>
                  {list.map((d) => (
                    <td key={d.date} className="!px-0.5 text-center">
                      {STATUS_SHORT[d.status] ? (
                        <Link href={`/attendance/${e.id}/${d.date}`} className={`block rounded px-1 py-0.5 font-semibold ${COLOR[d.status] ?? ""}`}>
                          {STATUS_SHORT[d.status]}{d.overridden ? "*" : ""}{d.missingOut && !d.overridden ? "!" : ""}
                        </Link>
                      ) : null}
                    </td>
                  ))}
                  <td>{c.present}</td><td>{c.absent}</td><td>{c.paidLeave + c.unpaidLeave}</td>
                </tr>
              );
            })}
            {employees.length === 0 && <tr><td colSpan={dates.length + 4} className="muted">{t("No employees.", "कोई कर्मचारी नहीं।")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
