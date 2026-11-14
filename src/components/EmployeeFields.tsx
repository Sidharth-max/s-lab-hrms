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
  bankWage?: string;
  cashWage?: string;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  upiId?: string | null;
  basicPercent?: number;
  pfEnabled?: boolean;
  esiEnabled?: boolean;
  uanNumber?: string | null;
  esicNumber?: string | null;
  customWeeklyOff?: boolean;
  inHouse?: boolean;
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
  // Salary in two parts: bank (PF / ESIC worked out on this) and cash. Total = bank + cash.
  const [bankWage, setBankWage] = useState(values.bankWage ?? values.wage ?? "");
  const [cashWage, setCashWage] = useState(values.cashWage ?? "");
  const num = (v: string) => Number(v.replace(/,/g, "")) || 0;
  const total = num(bankWage) + num(cashWage);
  const [today] = useState(() => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10)); // India date
  // Editing the salary: ask from which day the new salary applies (earlier days keep the old one).
  const wageChanged = !isNew && (num(bankWage) !== num(values.bankWage ?? values.wage ?? "") || num(cashWage) !== num(values.cashWage ?? "") || wageType !== values.wageType);
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
          <div className="@lg:col-span-2 grid gap-3 rounded-lg border border-[var(--line)] p-3 @lg:grid-cols-3">
            <div>
              <label className="label">{wageType === "MONTHLY" ? "Bank part per month (₹)" : "Bank part per day (₹)"}</label>
              <input name="bankWage" className="input" inputMode="decimal" value={bankWage} onChange={(e) => setBankWage(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label">{wageType === "MONTHLY" ? "Cash part per month (₹)" : "Cash part per day (₹)"}</label>
              <input name="cashWage" className="input" inputMode="decimal" value={cashWage} onChange={(e) => setCashWage(e.target.value)} placeholder="0" />
            </div>
            <div>
              <span className="label">{wageType === "MONTHLY" ? "Total salary per month" : "Total wage per day"}</span>
              <p className="flex h-11 items-center text-lg font-bold tabular-nums ink-violet sm:h-10">₹{total.toLocaleString("en-IN")}</p>
            </div>
            <p className="muted text-xs @lg:col-span-3">PF and ESIC are worked out on the bank part only. The cash part has no PF or ESIC.</p>
          </div>
          {wageChanged && (
            <div className="@lg:col-span-2 rounded-lg border border-[var(--line)] bg-[var(--amber-soft)] p-3">
              <label className="label">New salary applies from</label>
              <DateInput name="wageFrom" defaultValue={today} />
              <p className="muted mt-1 text-sm">Days before this keep the old salary. Days from this date use the new one. Nothing already earned is lost.</p>
            </div>
          )}
          <div>
            <label className="label">Basic % of wage (used for PF)</label>
            <input name="basicPercent" type="number" min={1} max={100} className="input" defaultValue={values.basicPercent ?? 100} />
          </div>
          <div className="flex flex-col justify-end gap-3 @lg:col-span-2">
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
          {canSalary && (
            <div className="@lg:col-span-2 grid gap-3 rounded-lg border border-[var(--line)] p-3 @lg:grid-cols-2">
              <p className="font-semibold @lg:col-span-2">Bank details (optional)</p>
              <div className="@lg:col-span-2">
                <label className="label">Account holder name</label>
                <input name="bankAccountName" className="input" defaultValue={values.bankAccountName ?? ""} placeholder="As on the bank account" />
              </div>
              <div>
                <label className="label">Account number</label>
                <input name="bankAccountNumber" className="input" inputMode="numeric" autoComplete="off" defaultValue={values.bankAccountNumber ?? ""} />
              </div>
              <div>
                <label className="label">Account number again</label>
                <input name="bankAccountNumber2" className="input" inputMode="numeric" autoComplete="off" defaultValue={values.bankAccountNumber ?? ""} onPaste={(e) => e.preventDefault()} />
              </div>
              <div>
                <label className="label">IFSC</label>
                <input name="bankIfsc" className="input uppercase" maxLength={11} defaultValue={values.bankIfsc ?? ""} placeholder="e.g. SBIN0001234" />
                {values.bankName ? <p className="muted mt-1 text-xs">{values.bankName}{values.bankBranch ? ` · ${values.bankBranch}` : ""}</p> : <p className="muted mt-1 text-xs">Bank and branch are filled in from the IFSC.</p>}
              </div>
              <div>
                <label className="label">UPI ID</label>
                <input name="upiId" className="input" autoComplete="off" defaultValue={values.upiId ?? ""} placeholder="e.g. name@okaxis" />
              </div>
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
