import { addHoliday, addSite, removeHoliday, toggleSite, updateSettings } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { dbToDateKey, formatDateKey } from "@/lib/time";
import { parseDayRules } from "@/lib/day-rules";

export default async function SettingsPage() {
  const actor = await requireStaff("settings.manage");
  const { t } = await getT();
  const DAYS = [
    t("Sunday", "रविवार"), t("Monday", "सोमवार"), t("Tuesday", "मंगलवार"), t("Wednesday", "बुधवार"),
    t("Thursday", "गुरुवार"), t("Friday", "शुक्रवार"), t("Saturday", "शनिवार"),
  ];
  const [b, sites, holidays] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
    db.site.findMany({ where: { businessId: actor.businessId }, orderBy: { name: "asc" } }),
    db.holiday.findMany({ where: { businessId: actor.businessId }, orderBy: { date: "desc" }, take: 60 }),
  ]);
  const dayRules = parseDayRules(b.dayRules);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">{t("Settings", "सेटिंग")}</h1>
      <section className="card">
        <h2 className="mb-3 font-semibold">{t("Business and attendance rules", "बिज़नेस और हाज़िरी के नियम")}</h2>
        <ActionForm action={updateSettings} className="flex flex-col gap-4">
          <div className="grid gap-3 @2xl:grid-cols-2">
            <div><label className="label">{t("Business name", "बिज़नेस का नाम")}</label><input name="name" className="input" defaultValue={b.name} required /></div>
            <div>
              <label className="label">{t("Ignore repeat scans within (minutes)", "दोबारा स्कैन इतने मिनट तक अनदेखा करें")}</label>
              <input name="duplicateScanMins" type="number" min={1} max={60} className="input" defaultValue={b.duplicateScanMins} />
            </div>
            <div>
              <label className="label">{t("Longest shift (hours). A scan after this starts a new day.", "सबसे लंबी शिफ़्ट (घंटे)। इसके बाद का स्कैन नया दिन माना जाएगा।")}</label>
              <input name="maxShiftHours" type="number" min={4} max={24} className="input" defaultValue={b.maxShiftHours} />
            </div>
          </div>
          <h3 className="font-semibold">{t("Weekly schedule", "हफ़्ते का शेड्यूल")}</h3>
          <p className="muted -mt-3">
            {t(
              "Weekly off: paid day off for monthly staff (an employee can have their own days, set on the employee). Half day: worked less than these hours. Any scan = full day: for short days like Sunday.",
              "साप्ताहिक छुट्टी: महीने वालों के लिए पैसे वाली छुट्टी (हर कर्मचारी के अपने दिन भी हो सकते हैं, कर्मचारी में सेट करें)। आधा दिन: इतने घंटे से कम काम। कोई भी स्कैन = पूरा दिन: रविवार जैसे छोटे दिनों के लिए।",
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="table table-cards">
              <thead>
                <tr>
                  <th>{t("Day", "दिन")}</th>
                  <th>{t("Weekly off", "साप्ताहिक छुट्टी")}</th>
                  <th>{t("Opens", "खुलता")}</th>
                  <th>{t("Closes", "बंद")}</th>
                  <th>{t("Half day below (hours, 0 = never)", "आधा दिन, इससे कम घंटे (0 = कभी नहीं)")}</th>
                  <th>{t("Any scan = full day", "कोई भी स्कैन = पूरा दिन")}</th>
                </tr>
              </thead>
              <tbody>
                {dayRules.map((r, i) => (
                  <tr key={i}>
                    <td className="card-title font-medium">{DAYS[i]}</td>
                    <td data-label={t("Weekly off", "साप्ताहिक छुट्टी")}>
                      <input type="checkbox" name={`off_${i}`} defaultChecked={b.weeklyOffDays.includes(i)} className="h-5 w-5" />
                    </td>
                    <td data-label={t("Opens", "खुलता")}><input type="time" name={`open_${i}`} defaultValue={r.open} className="input !w-32" required /></td>
                    <td data-label={t("Closes", "बंद")}><input type="time" name={`close_${i}`} defaultValue={r.close} className="input !w-32" required /></td>
                    <td data-label={t("Half day below (hours)", "आधा दिन, इससे कम घंटे")}>
                      <input type="number" name={`half_${i}`} step="0.5" min={0} max={12} defaultValue={r.halfDayBelowMins / 60} className="input !w-24" />
                    </td>
                    <td data-label={t("Any scan = full day", "कोई भी स्कैन = पूरा दिन")}>
                      <input type="checkbox" name={`any_${i}`} defaultChecked={r.anyScanFullDay} className="h-5 w-5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="font-semibold">{t("PF and ESIC rates", "PF और ESIC की दरें")}</h3>
          <p className="muted -mt-3">
            {t("Used only for employees with PF / ESIC switched on. Check the current official rates with your accountant.", "सिर्फ़ उन कर्मचारियों के लिए जिनका PF / ESIC चालू है। सही सरकारी दरें अपने अकाउंटेंट से पक्की करें।")}
          </p>
          <div className="grid gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">
            <div><label className="label">{t("PF employee %", "PF कर्मचारी %")}</label><input name="pfEmployeePct" type="number" step="0.01" className="input" defaultValue={b.pfEmployeeBps / 100} /></div>
            <div><label className="label">{t("PF employer %", "PF कंपनी %")}</label><input name="pfEmployerPct" type="number" step="0.01" className="input" defaultValue={b.pfEmployerBps / 100} /></div>
            <div><label className="label">{t("PF wage ceiling ₹ (PF is worked out on basic up to this amount)", "PF वेतन सीमा ₹ (बेसिक पर इतनी रकम तक PF)")}</label><input name="pfWageCeiling" type="number" className="input" defaultValue={b.pfWageCeiling / 100} /></div>
            <div><label className="label">{t("ESIC employee %", "ESIC कर्मचारी %")}</label><input name="esiEmployeePct" type="number" step="0.01" className="input" defaultValue={b.esiEmployeeBps / 100} /></div>
            <div><label className="label">{t("ESIC employer %", "ESIC कंपनी %")}</label><input name="esiEmployerPct" type="number" step="0.01" className="input" defaultValue={b.esiEmployerBps / 100} /></div>
          </div>
        </ActionForm>
      </section>

      <div className="grid gap-4 @4xl:grid-cols-2">
        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">{t("Sites / branches", "साइट / ब्रांच")}</h2>
          <ul className="flex flex-col gap-2">
            {sites.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span className={s.active ? "" : "text-[var(--muted)] line-through"}>{s.name}</span>
                <ActionForm action={toggleSite} submitLabel={s.active ? t("Disable", "बंद करें") : t("Enable", "चालू करें")} submitClass="btn-secondary !py-1">
                  <input type="hidden" name="siteId" value={s.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
          <ActionForm action={addSite} className="flex gap-2" submitLabel={t("Add site", "साइट जोड़ें")} resetOnSuccess>
            <input name="name" className="input" placeholder={t("New site name", "नई साइट का नाम")} required />
          </ActionForm>
        </section>

        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">{t("Holidays (paid for monthly staff)", "त्योहार की छुट्टियाँ (महीने वालों को पैसे मिलते हैं)")}</h2>
          <ActionForm action={addHoliday} className="flex flex-wrap gap-2" submitLabel={t("Add", "जोड़ें")} resetOnSuccess>
            <input name="date" type="date" className="input max-w-[11rem]" required />
            <input name="name" className="input max-w-[14rem]" placeholder={t("Holiday name", "छुट्टी का नाम")} required />
          </ActionForm>
          <ul className="flex flex-col gap-1">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{formatDateKey(dbToDateKey(h.date))} · {h.name}</span>
                <ActionForm action={removeHoliday} submitLabel={t("Remove", "हटाएं")} submitClass="btn-secondary !py-1">
                  <input type="hidden" name="holidayId" value={h.id} />
                </ActionForm>
              </li>
            ))}
            {holidays.length === 0 && <li className="muted">{t("No holidays added.", "कोई छुट्टी नहीं जोड़ी।")}</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
