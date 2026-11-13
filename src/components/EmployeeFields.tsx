"use client";

import { useState } from "react";
import { DateInput, Select } from "@/components/controls";

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
  uanNumber?: string | null;
  esicNumber?: string | null;
  customWeeklyOff?: boolean;
  inHouse?: boolean;
  holdSalary?: boolean;
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
  const [pf, setPf] = useState(values.pfEnabled ?? false);
  const [esi, setEsi] = useState(values.esiEnabled ?? false);
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
        <input name="code" className="input uppercase" defaultValue={values.code} disabled={!isNew} maxLength={12} placeholder="Automatic" />
      </div>
      <div>
        <label className="label">Mobile (optional, needed for web login)</label>
        <input name="phone" className="input" inputMode="numeric" defaultValue={values.phone ?? ""} />
      </div>
      <div>
        <label className="label">Site</label>
        <Select name="siteId" defaultValue={values.siteId} options={sites.map((s) => ({ value: s.id, label: s.name }))} ariaLabel="Site" />
      </div>
      <div>
        <label className="label">Joining date</label>
        <DateInput name="joinedOn" defaultValue={values.joinedOn} />
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--line)] p-3 @lg:col-span-2">
        <input type="checkbox" name="inHouse" defaultChecked={values.inHouse ?? false} className="mt-0.5 h-5 w-5" />
        <span>
          <span className="block font-medium">In-house employee</span>
          <span className="muted block">Marked present automatically on every working day, without scanning. They can still scan if they want; it always counts as a full day.</span>
        </span>
      </label>
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
          <div className="flex flex-col justify-end gap-3 @lg:col-span-2">
            {canSalary && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--line)] p-3">
                <input type="checkbox" name="holdSalary" defaultChecked={values.holdSalary ?? false} className="mt-0.5 h-5 w-5" />
                <span>
                  <span className="block font-medium">Hold salary, pay later together</span>
                  <span className="muted block">Salary is still calculated every month, but kept as due. Pay several months (or the whole year) in one go from the employee&apos;s Salary tab. Advances are taken from the held amount.</span>
                </span>
              </label>
            )}
            {canSalary ? (
              <div className="grid gap-3 @lg:grid-cols-2">
                <div className="flex flex-col gap-2 rounded-lg border border-[var(--line)] p-3">
                  <label className="flex items-center gap-2 font-medium"><input type="checkbox" name="pfEnabled" checked={pf} onChange={(e) => setPf(e.target.checked)} className="h-5 w-5" /> PF deduction</label>
                  {pf && (
                    <div>
                      <label className="label">PF UAN (12 digits, optional)</label>
                      <input name="uanNumber" className="input" inputMode="numeric" maxLength={14} defaultValue={values.uanNumber ?? ""} placeholder="e.g. 100123456789" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 rounded-lg border border-[var(--line)] p-3">
                  <label className="flex items-center gap-2 font-medium"><input type="checkbox" name="esiEnabled" checked={esi} onChange={(e) => setEsi(e.target.checked)} className="h-5 w-5" /> ESIC deduction</label>
                  {esi && (
                    <div>
                      <label className="label">ESIC IP number (10 digits, optional)</label>
                      <input name="esicNumber" className="input" inputMode="numeric" maxLength={12} defaultValue={values.esicNumber ?? ""} placeholder="e.g. 3112345678" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="muted">PF / ESIC stay off. A user with salary permission can turn them on.</p>
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}
