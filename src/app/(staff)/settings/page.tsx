import { addHoliday, addSite, removeHoliday, toggleSite, updateSettings } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { dbToDateKey, formatDateKey } from "@/lib/time";

export default async function SettingsPage() {
  const actor = await requireStaff("settings.manage");
  const { t } = await getT();
  const DAYS = [t("Sun", "रवि"), t("Mon", "सोम"), t("Tue", "मंगल"), t("Wed", "बुध"), t("Thu", "गुरु"), t("Fri", "शुक्र"), t("Sat", "शनि")];
  const [b, sites, holidays] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
    db.site.findMany({ where: { businessId: actor.businessId }, orderBy: { name: "asc" } }),
    db.holiday.findMany({ where: { businessId: actor.businessId }, orderBy: { date: "desc" }, take: 60 }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">{t("Settings", "सेटिंग")}</h1>
      <section className="card">
        <h2 className="mb-3 font-semibold">{t("Business and attendance rules", "बिज़नेस और हाज़िरी के नियम")}</h2>
        <ActionForm action={updateSettings} className="flex flex-col gap-4">
          <div className="grid gap-3 @2xl:grid-cols-2">
            <div><label className="label">{t("Business name", "बिज़नेस का नाम")}</label><input name="name" className="input" defaultValue={b.name} required /></div>
            <div>
              <label className="label">{t("Weekly off (paid for monthly staff)", "साप्ताहिक छुट्टी (महीने वालों को पैसे मिलते हैं)")}</label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((d, i) => (
                  <label key={i} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="weeklyOffDays" value={i} defaultChecked={b.weeklyOffDays.includes(i)} /> {d}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">{t("Half day if worked less than (hours, 0 = off)", "इतने घंटे से कम काम = आधा दिन (0 = बंद)")}</label>
              <input name="halfDayBelowHours" type="number" step="0.5" min={0} max={12} className="input" defaultValue={b.halfDayBelowMins / 60} />
            </div>
            <div>
              <label className="label">{t("Ignore repeat scans within (minutes)", "दोबारा स्कैन इतने मिनट तक अनदेखा करें")}</label>
              <input name="duplicateScanMins" type="number" min={1} max={60} className="input" defaultValue={b.duplicateScanMins} />
            </div>
            <div>
              <label className="label">{t("Longest shift (hours). A scan after this starts a new day.", "सबसे लंबी शिफ़्ट (घंटे)। इसके बाद का स्कैन नया दिन माना जाएगा।")}</label>
              <input name="maxShiftHours" type="number" min={4} max={24} className="input" defaultValue={b.maxShiftHours} />
            </div>
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
