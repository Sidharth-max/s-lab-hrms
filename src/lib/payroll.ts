// Salary calculation. Pure functions, all money in paise.

import type { DayCounts } from "./attendance";
import { monthDiff } from "./time";

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

export interface AdvanceInput {
  id: string;
  amount: number;
  recoveryMonths: number;
  startMonth: string;
  recoveredBefore: number; // recovered in locked salary months
  givenOn: string;
}

export interface PayResult {
  rate: number;
  daysInMonth: number;
  payableDays: number;
  presentDays: number;
  paidOffDays: number;
  gross: number;
  adjustments: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  advanceRecovered: number;
  recoveries: { advanceId: string; amount: number }[];
  net: number;
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

/** Instalment due this month for one advance: spread the remaining balance over the months left. */
export function advanceDue(a: AdvanceInput, month: string): number {
  const remaining = a.amount - a.recoveredBefore;
  if (remaining <= 0 || month < a.startMonth) return 0;
  const monthsLeft = Math.max(1, a.recoveryMonths - monthDiff(a.startMonth, month));
  const due = Math.ceil(remaining / monthsLeft / 100) * 100; // whole rupees
  return Math.min(due, remaining);
}

export function calculatePay(input: {
  month: string;
  daysInMonth: number;
  counts: DayCounts;
  employee: EmployeePay;
  rates: StatutoryRates;
  adjustments: number;
  advances: AdvanceInput[];
}): PayResult {
  const { employee: emp, counts } = input;
  const payable = payableDays(emp, counts);
  const gross = grossPay(emp, payable, input.daysInMonth);
  const st = statutory(emp, gross, input.rates);
  const beforeAdvances = gross + input.adjustments - st.pfEmployee - st.esiEmployee;

  // Recover advances oldest first, never more than the salary available; the rest rolls to next month.
  let available = Math.max(0, beforeAdvances);
  const recoveries: { advanceId: string; amount: number }[] = [];
  const ordered = [...input.advances].sort((a, b) => (a.givenOn < b.givenOn ? -1 : a.givenOn > b.givenOn ? 1 : 0));
  for (const a of ordered) {
    const take = Math.min(advanceDue(a, input.month), available);
    if (take > 0) {
      recoveries.push({ advanceId: a.id, amount: take });
      available -= take;
    }
  }
  const advanceRecovered = recoveries.reduce((s, r) => s + r.amount, 0);

  return {
    rate: emp.wageType === "MONTHLY" ? emp.monthlyWage : emp.dailyWage,
    daysInMonth: input.daysInMonth,
    payableDays: payable,
    presentDays: counts.present,
    paidOffDays: emp.wageType === "MONTHLY" ? counts.paidOff : 0,
    gross,
    adjustments: input.adjustments,
    ...st,
    advanceRecovered,
    recoveries,
    net: beforeAdvances - advanceRecovered,
  };
}
