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
}

export function EmployeeFields({
  sites,
  values = {},
  isNew,
  canSalary,
}: {
  sites: { id: string; name: string }[];
  values?: Values;
  isNew: boolean;
  canSalary: boolean;
}) {
  const [wageType, setWageType] = useState(values.wageType ?? "MONTHLY");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
      {(isNew || canSalary) && (
        <fieldset className="contents" disabled={!isNew && !canSalary}>
          <div>
            <label className="label">Paid</label>
            <div className="flex gap-2">
              {(["MONTHLY", "DAILY"] as const).map((t) => (
                <label key={t} className={`btn-secondary flex-1 cursor-pointer ${wageType === t ? "!border-[var(--brand)] !text-[var(--brand)]" : ""}`}>
                  <input type="radio" name="wageType" value={t} checked={wageType === t} onChange={() => setWageType(t)} className="sr-only" />
                  {t === "MONTHLY" ? "Monthly salary" : "Daily wage"}
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
                <label className="flex items-center gap-2"><input type="checkbox" name="pfEnabled" defaultChecked={values.pfEnabled ?? false} className="h-5 w-5" /> PF deduction</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="esiEnabled" defaultChecked={values.esiEnabled ?? false} className="h-5 w-5" /> ESIC deduction</label>
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
