"use client";

import { useState } from "react";

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
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const businessOffText = businessWeeklyOff.length ? businessWeeklyOff.map((d) => DAYS[d]).join(", ") : "none";
  return (
    <div className="grid gap-3 @lg:grid-cols-2">
      <div>
        <label className="label">Full name</label>
        <input name="name" className="input" defaultValue={values.name} required />
      </div>
      <div>
        <label className="label">Employee code</label>
        <input name="code" className="input uppercase" defaultValue={values.code} required={isNew} disabled={!isNew} maxLength={12} />
      </div>
      <div>
        <label className="label">Mobile (optional, needed for web login)</label>
        <input name="phone" className="input" inputMode="numeric" defaultValue={values.phone ?? ""} />
      </div>
      <div>
        <label className="label">Site</label>
        <select name="siteId" className="input" defaultValue={values.siteId} required>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Joining date</label>
        <input name="joinedOn" type="date" className="input" defaultValue={values.joinedOn} required />
      </div>
      <div className="@lg:col-span-2">
        <label className="label">Weekly off</label>
        <div className="flex flex-wrap items-center gap-2">
          {[false, true].map((c) => (
            <label key={String(c)} className={`btn-secondary cursor-pointer ${customOff === c ? "!border-[var(--brand)] !text-[var(--brand)]" : ""}`}>
              <input type="radio" name="weeklyOffMode" value={c ? "custom" : "business"} checked={customOff === c} onChange={() => setCustomOff(c)} className="sr-only" />
              {c ? "Own days" : `${"Same as business"} (${businessOffText})`}
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
            <label className="label">Paid</label>
            <div className="flex gap-2">
              {(["MONTHLY", "DAILY"] as const).map((w) => (
                <label key={w} className={`btn-secondary flex-1 cursor-pointer ${wageType === w ? "!border-[var(--brand)] !text-[var(--brand)]" : ""}`}>
                  <input type="radio" name="wageType" value={w} checked={wageType === w} onChange={() => setWageType(w)} className="sr-only" />
                  {w === "MONTHLY" ? "Monthly salary" : "Daily wage"}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{wageType === "MONTHLY" ? "Salary per month (₹)" : "Wage per day (₹)"}</label>
            <input name="wage" className="input" inputMode="decimal" defaultValue={values.wage} required />
          </div>
          <div>
            <label className="label">Basic % of wage (used for PF)</label>
            <input name="basicPercent" type="number" min={1} max={100} className="input" defaultValue={values.basicPercent ?? 100} />
          </div>
          <div className="flex flex-col justify-end gap-2">
            {canSalary ? (
              <>
                <label className="flex items-center gap-2"><input type="checkbox" name="pfEnabled" defaultChecked={values.pfEnabled ?? false} className="h-5 w-5" /> {"PF deduction"}</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="esiEnabled" defaultChecked={values.esiEnabled ?? false} className="h-5 w-5" /> {"ESIC deduction"}</label>
              </>
            ) : (
              <p className="muted">PF / ESIC stay off. A user with salary permission can turn them on.</p>
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}
