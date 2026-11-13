// Salary calculation. Pure functions, all money in paise.

import type { DayCounts } from "./attendance";

export interface StatutoryRates {
  pfEmployeeBps: number;
  pfEmployerBps: number;
  pfWageCeiling: number;
  esiEmployeeBps: number;
  esiEmployerBps: number;
}

export interface EmployeePay {
  wageType: "MONTHLY" | "DAILY";
  monthlyWage: number;
  dailyWage: number;
  basicPercent: number;
  pfEnabled: boolean;
  esiEnabled: boolean;
}

/** Monthly staff are paid for weekly offs and holidays; daily-wage staff only for days worked and paid leave. */
export function payableDays(emp: Pick<EmployeePay, "wageType">, c: DayCounts): number {
  const worked = c.present + c.paidLeave;
  return emp.wageType === "MONTHLY" ? worked + c.paidOff : worked;
}

export function grossPay(emp: EmployeePay, payable: number, daysInMonth: number): number {
  if (emp.wageType === "MONTHLY") return Math.round((emp.monthlyWage * payable) / daysInMonth);
  return Math.round(emp.dailyWage * payable);
}

export function statutory(emp: EmployeePay, gross: number, rates: StatutoryRates) {
  let pfEmployee = 0;
  let pfEmployer = 0;
  let esiEmployee = 0;
  let esiEmployer = 0;
  if (emp.pfEnabled && gross > 0) {
    const basic = Math.round((gross * emp.basicPercent) / 100);
    const pfWage = Math.min(basic, rates.pfWageCeiling);
    pfEmployee = Math.round((pfWage * rates.pfEmployeeBps) / 10000 / 100) * 100;
    pfEmployer = Math.round((pfWage * rates.pfEmployerBps) / 10000 / 100) * 100;
  }
  if (emp.esiEnabled && gross > 0) {
    // ESIC contributions are rounded up to the next rupee.
    esiEmployee = Math.ceil((gross * rates.esiEmployeeBps) / 10000 / 100) * 100;
    esiEmployer = Math.ceil((gross * rates.esiEmployerBps) / 10000 / 100) * 100;
  }
  return { pfEmployee, pfEmployer, esiEmployee, esiEmployer };
}

// ---------- Running ledger (no salary months) ----------

export interface WageRate {
  effectiveFrom: string; // YYYY-MM-DD
  wageType: "MONTHLY" | "DAILY";
  monthlyWage: number;
  dailyWage: number;
}

/** Share of a day's pay earned for a day status. Weekly offs and holidays are paid to monthly staff only. */
export function dayFactor(status: string, wageType: "MONTHLY" | "DAILY"): number {
  switch (status) {
    case "PRESENT":
    case "PAID_LEAVE":
      return 1;
    case "HALF_DAY":
      return 0.5;
    case "WEEKLY_OFF":
    case "HOLIDAY":
      return wageType === "MONTHLY" ? 1 : 0;
    default:
      return 0;
  }
}

/** The salary in effect on a day: the latest change on or before it (before the first change, the first one). */
export function wageOn(rates: WageRate[], date: string): WageRate | null {
  if (rates.length === 0) return null;
  let pick = rates[0];
  for (const r of rates) if (r.effectiveFrom <= date) pick = r;
  return pick;
}

/** One day's pay at full attendance: a month's salary is split over that month's days (28 to 31). */
export function dayRate(rate: WageRate, daysInMonth: number): number {
  return rate.wageType === "MONTHLY" ? rate.monthlyWage / daysInMonth : rate.dailyWage;
}
