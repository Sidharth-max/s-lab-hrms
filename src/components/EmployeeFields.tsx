"use client";

import { useState } from "react";
import { useT } from "./LangProvider";

interface Values {
  name?: string;
  code?: string;
  phone?: string | null;
  siteId?: string;
  joinedOn?: string;
  wageType?: "MONTHLY" | "DAILY";
  wage?: string;
  basicPercent?: number;
  pfEnabled?: boolean;
  esiEnabled?: boolean;
  customWeeklyOff?: boolean;
  weeklyOffDays?: number[];
}

export function EmployeeFields({
  sites,
  values = {},
  isNew,
  canSalary,
  businessWeeklyOff,
}: {
  businessWeeklyOff: number[];
  sites: { id: string; name: string }[];
  values?: Values;
  isNew: boolean;
  canSalary: boolean;
}) {
  const [wageType, setWageType] = useState(values.wageType ?? "MONTHLY");
  const [customOff, setCustomOff] = useState(values.customWeeklyOff ?? false);
  const t = useT();
  const DAYS = [t("Sun", "रवि"), t("Mon", "सोम"), t("Tue", "मंगल"), t("Wed", "बुध"), t("Thu", "गुरु"), t("Fri", "शुक्र"), t("Sat", "शनि")];
  const businessOffText = businessWeeklyOff.length ? businessWeeklyOff.map((d) => DAYS[d]).join(", ") : t("none", "कोई नहीं");
  return (
    <div className="grid gap-3 @lg:grid-cols-2">
      <div>
        <label className="label">{t("Full name", "पूरा नाम")}</label>
        <input name="name" className="input" defaultValue={values.name} required />
      </div>
      <div>
        <label className="label">{t("Employee code", "कर्मचारी कोड")}</label>
        <input name="code" className="input uppercase" defaultValue={values.code} required={isNew} disabled={!isNew} maxLength={12} />
      </div>
      <div>
        <label className="label">{t("Mobile (optional, needed for web login)", "मोबाइल (वेब लॉग इन के लिए ज़रूरी)")}</label>
        <input name="phone" className="input" inputMode="numeric" defaultValue={values.phone ?? ""} />
      </div>
      <div>
        <label className="label">{t("Site", "साइट")}</label>
        <select name="siteId" className="input" defaultValue={values.siteId} required>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">{t("Joining date", "जॉइनिंग की तारीख़")}</label>
        <input name="joinedOn" type="date" className="input" defaultValue={values.joinedOn} required />
      </div>
      <div className="@lg:col-span-2">
        <label className="label">{t("Weekly off", "साप्ताहिक छुट्टी")}</label>
        <div className="flex flex-wrap items-center gap-2">
          {[false, true].map((c) => (
            <label key={String(c)} className={`btn-secondary cursor-pointer ${customOff === c ? "!border-[var(--brand)] !text-[var(--brand)]" : ""}`}>
              <input type="radio" name="weeklyOffMode" value={c ? "custom" : "business"} checked={customOff === c} onChange={() => setCustomOff(c)} className="sr-only" />
              {c ? t("Own days", "अपने दिन") : `${t("Same as business", "बिज़नेस जैसा")} (${businessOffText})`}
            </label>
          ))}
        </div>
        {customOff && (
          <div className="mt-2 flex flex-wrap gap-3">
            {DAYS.map((d, i) => (
              <label key={i} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="empWeeklyOff" value={i} defaultChecked={values.weeklyOffDays?.includes(i)} className="h-4 w-4" /> {d}
              </label>
            ))}
          </div>
        )}
      </div>
      {(isNew || canSalary) && (
        <fieldset className="contents" disabled={!isNew && !canSalary}>
          <div>
            <label className="label">{t("Paid", "वेतन")}</label>
            <div className="flex gap-2">
              {(["MONTHLY", "DAILY"] as const).map((w) => (
                <label key={w} className={`btn-secondary flex-1 cursor-pointer ${wageType === w ? "!border-[var(--brand)] !text-[var(--brand)]" : ""}`}>
                  <input type="radio" name="wageType" value={w} checked={wageType === w} onChange={() => setWageType(w)} className="sr-only" />
                  {w === "MONTHLY" ? t("Monthly salary", "महीने की सैलरी") : t("Daily wage", "रोज़ की दिहाड़ी")}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{wageType === "MONTHLY" ? t("Salary per month (₹)", "महीने की सैलरी (₹)") : t("Wage per day (₹)", "एक दिन की दिहाड़ी (₹)")}</label>
            <input name="wage" className="input" inputMode="decimal" defaultValue={values.wage} required />
          </div>
          <div>
            <label className="label">{t("Basic % of wage (used for PF)", "बेसिक % (PF के लिए)")}</label>
            <input name="basicPercent" type="number" min={1} max={100} className="input" defaultValue={values.basicPercent ?? 100} />
          </div>
          <div className="flex flex-col justify-end gap-2">
            {canSalary ? (
              <>
                <label className="flex items-center gap-2"><input type="checkbox" name="pfEnabled" defaultChecked={values.pfEnabled ?? false} className="h-5 w-5" /> {t("PF deduction", "PF कटौती")}</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="esiEnabled" defaultChecked={values.esiEnabled ?? false} className="h-5 w-5" /> {t("ESIC deduction", "ESIC कटौती")}</label>
              </>
            ) : (
              <p className="muted">{t("PF / ESIC stay off. A user with salary permission can turn them on.", "PF / ESIC बंद रहेंगे। सैलरी की अनुमति वाला यूज़र इन्हें चालू कर सकता है।")}</p>
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}
