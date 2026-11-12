import Link from "next/link";
import { notFound } from "next/navigation";
import { addManualPunch, clearDayStatus, setDayStatus, voidPunch } from "@/app/actions/attendance";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { statusLabel } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { can, canSeeSite } from "@/lib/permissions";
import { monthAttendance } from "@/lib/services";
import { dateKeyToDb, formatDateKey, formatIstTime, istDateKey } from "@/lib/time";

export default async function DayDetail({ params }: PageProps<"/attendance/[employeeId]/[date]">) {
  const actor = await requireStaff();
  const { t, lang } = await getT();
  const { employeeId, date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const emp = await db.employee.findFirst({ where: { id: employeeId, businessId: actor.businessId } });
  if (!emp || !canSeeSite(actor, emp.siteId)) notFound();

  const [punches, overrides, run, { days }] = await Promise.all([
    db.attendancePunch.findMany({ where: { employeeId, workDate: dateKeyToDb(date) }, orderBy: { at: "asc" } }),
    db.dayOverride.findMany({ where: { employeeId, workDate: dateKeyToDb(date) }, orderBy: { createdAt: "desc" } }),
    db.payrollRun.findUnique({ where: { businessId_month: { businessId: actor.businessId, month: date.slice(0, 7) } } }),
    monthAttendance(actor.businessId, date.slice(0, 7), [emp]),
  ]);
  const userIds = [...new Set([...punches.map((p) => p.createdBy), ...punches.map((p) => p.voidedBy), ...overrides.map((o) => o.createdBy)].filter(Boolean) as string[])];
  const users = new Map((await db.user.findMany({ where: { id: { in: userIds } } })).map((u) => [u.id, u.name]));
  const day = days.get(emp.id)!.find((d) => d.date === date)!;
  const locked = run?.status === "LOCKED";
  const editable = can(actor, "attendance.edit") && !locked && date <= istDateKey(new Date());
  const statuses = [
    ["PRESENT", t("Present", "हाज़िर")],
    ["HALF_DAY", t("Half day", "आधा दिन")],
    ["ABSENT", t("Absent", "ग़ैरहाज़िर")],
    ["PAID_LEAVE", t("Paid leave", "सवेतन छुट्टी")],
    ["UNPAID_LEAVE", t("Unpaid leave", "बिना वेतन छुट्टी")],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/attendance?date=${date}`} className="muted underline">← {t("Attendance", "हाज़िरी")}</Link>
        <h1 className="h1">{emp.name} · {formatDateKey(date)}</h1>
        <p className="text-lg">
          {statusLabel(day.status, lang) || "—"} {day.overridden && <span className="badge bg-blue-50 text-[var(--brand)]">{t("manual", "हाथ से")}</span>}
        </p>
      </div>
      {locked && (
        <div className="card border-amber-200 bg-amber-50 text-sm">
          {t("Salary for this month is locked, so this day cannot be edited. Use an adjustment in next month's salary.", "इस महीने की सैलरी लॉक है, इसलिए यह दिन नहीं बदल सकते। अगले महीने की सैलरी में एडजस्टमेंट जोड़ें।")}
        </div>
      )}
      {!can(actor, "attendance.edit") && <div className="card muted text-sm">{t("You can view but not edit attendance.", "आप हाज़िरी देख सकते हैं, बदल नहीं सकते।")}</div>}

      <section className="card">
        <h2 className="mb-2 font-semibold">{t("Punches", "पंच")}</h2>
        <table className="table table-cards">
          <thead><tr><th>{t("Type", "प्रकार")}</th><th>{t("Time", "समय")}</th><th>{t("How", "कैसे")}</th><th /></tr></thead>
          <tbody>
            {punches.map((p) => (
              <tr key={p.id} className={p.voidedAt ? "text-[var(--muted)] line-through" : ""}>
                <td className="card-title font-semibold">{p.type === "IN" ? t("IN", "आए") : t("OUT", "गए")}</td>
                <td data-label={t("Time", "समय")}>{formatIstTime(p.at)}{istDateKey(p.at) !== date ? ` (${formatDateKey(istDateKey(p.at))})` : ""}</td>
                <td data-label={t("How", "कैसे")}>
                  <span>
                    {p.source === "FACE"
                      ? `${t("Face scan", "फ़ेस स्कैन")}${p.score ? ` (${p.score.toFixed(1)}%)` : ""}`
                      : `${t("Manual by", "हाथ से:")} ${users.get(p.createdBy ?? "") ?? "?"}: ${p.reason}`}
                    {p.voidedAt && <span className="block text-xs">{t("Removed by", "हटाया:")} {users.get(p.voidedBy ?? "") ?? "?"}: {p.voidReason}</span>}
                  </span>
                </td>
                <td>
                  {editable && !p.voidedAt && (
                    <ActionForm action={voidPunch} submitLabel={t("Remove", "हटाएं")} submitClass="btn-secondary !py-1" confirm={t("Remove this punch? It stays in history.", "यह पंच हटाएं? इतिहास में रहेगा।")}>
                      <input type="hidden" name="punchId" value={p.id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
            {punches.length === 0 && <tr><td colSpan={4} className="muted">{t("No punches.", "कोई पंच नहीं।")}</td></tr>}
          </tbody>
        </table>
      </section>

      {editable && (
        <div className="grid gap-4 @2xl:grid-cols-2">
          <section className="card">
            <h2 className="mb-3 font-semibold">{t("Add missed punch", "छूटा पंच जोड़ें")}</h2>
            <ActionForm action={addManualPunch} className="flex flex-col gap-3" submitLabel={t("Add punch", "पंच जोड़ें")} resetOnSuccess>
              <input type="hidden" name="employeeId" value={emp.id} />
              <input type="hidden" name="date" value={date} />
              <div className="flex gap-2">
                <select name="type" className="input"><option value="IN">{t("IN", "आए")}</option><option value="OUT">{t("OUT", "गए")}</option></select>
                <input type="time" name="time" className="input" required />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="nextDay" /> {t("Time is after midnight (night shift)", "समय आधी रात के बाद का है (नाइट शिफ़्ट)")}</label>
              <input name="reason" className="input" placeholder={t("Reason (e.g. tablet not working)", "कारण (जैसे टैबलेट ख़राब)")} required />
            </ActionForm>
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold">{t("Set day status", "दिन की स्थिति तय करें")}</h2>
            <ActionForm action={setDayStatus} className="flex flex-col gap-3" submitLabel={t("Set status", "स्थिति सेव करें")} resetOnSuccess>
              <input type="hidden" name="employeeId" value={emp.id} />
              <input type="hidden" name="date" value={date} />
              <select name="status" className="input" defaultValue="PRESENT">
                {statuses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input name="reason" className="input" placeholder={t("Reason", "कारण")} required />
            </ActionForm>
            {day.overridden && (
              <div className="mt-3">
                <ActionForm action={clearDayStatus} submitLabel={t("Back to automatic (from scans)", "वापस अपने-आप (स्कैन से)")} submitClass="btn-secondary">
                  <input type="hidden" name="employeeId" value={emp.id} />
                  <input type="hidden" name="date" value={date} />
                </ActionForm>
              </div>
            )}
          </section>
        </div>
      )}

      {overrides.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">{t("Edit history", "बदलाव का इतिहास")}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {overrides.map((o) => (
              <li key={o.id}>
                {o.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}: {users.get(o.createdBy) ?? "?"} →{" "}
                <b>{o.status === "AUTO" ? t("automatic", "अपने-आप") : statusLabel(o.status, lang)}</b> — {o.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
