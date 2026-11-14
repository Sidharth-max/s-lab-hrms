import "server-only";
import { STATUS_LABEL, type DayResult } from "./attendance";
import { db } from "./db";
import { hisaabOf } from "./ledger";
import { bankShare, dayFactor, dayRate, monthDaysAdjustment, statutory, wageOn, type WageRate } from "./payroll";
import { monthAttendance, shiftsOf } from "./services";
import { addMonths, daysInMonth, dbToDateKey, dateKeyToDb, formatIstTime, istDateKey, weekday } from "./time";

// Salary statement for one employee over any date range (e.g. 1st to 30th): every day's attendance
// (status, in / out, late, left early) and the salary worked out for those days, with advances,
// payments and extra pay / deductions dated inside the range. Used for the PDF and Excel export.
//
// Each day is paid exactly as in the ledger (lib/ledger.ts): that day's rate x day factor, split into
// bank and cash parts. PF / ESIC are worked out per calendar month on the bank part earned in the
// range, so a full month gives the same numbers as the ledger.

export const MAX_STATEMENT_DAYS = 366;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface StatementDay {
  date: string;
  weekday: string;
  status: string; // label, "" for days before joining / in the future
  inTime: string | null;
  outTime: string | null;
  workedMins: number;
  lateMins: number;
  earlyMins: number;
  missingOut: boolean;
  manual: boolean;
  factor: number; // share of the day's pay earned (1, 0.5, 0)
  pay: number; // paise
}

export interface StatementEntry {
  date: string;
  kind: "Advance" | "Payment" | "Extra pay" | "Deduction";
  amount: number; // paise, positive
  note: string;
}

export interface Statement {
  business: string;
  generatedOn: string;
  from: string;
  to: string;
  employee: {
    name: string;
    code: string;
    site: string;
    shift: string;
    phone: string | null;
    joinedOn: string;
    wageType: "MONTHLY" | "DAILY";
    wage: number;
    bankWage: number;
    cashWage: number;
    pf: boolean;
    esi: boolean;
    uan: string | null;
    esic: string | null;
    bank: { name: string | null; account: string | null; ifsc: string | null; bankName: string | null; upi: string | null } | null;
  };
  days: StatementDay[];
  counts: {
    present: number;
    halfDays: number;
    absent: number;
    paidLeave: number;
    unpaidLeave: number;
    weeklyOff: number;
    holidays: number;
    lateDays: number;
    lateMins: number;
    earlyDays: number;
    earlyMins: number;
    missingOut: number;
    payableDays: number;
    workedMins: number;
  };
  money: {
    gross: number;
    /** Part of gross from the 30-day month rule (a whole month pays the full salary); can be negative. */
    monthAdjust: number;
    bankGross: number;
    cashGross: number;
    pf: number;
    esi: number;
    earned: number; // gross - pf - esi
    extras: number;
    deductions: number;
    advances: number;
    payments: number;
    net: number; // earned + extras - deductions - advances - payments (for this range only)
    balanceToday: number; // whole running ledger, today
  };
  entries: StatementEntry[];
}

/** Checks the range: both dates, from <= to, at most a year. */
export function checkRange(from: string | null, to: string | null): { from: string; to: string } | { error: string } {
  const ok = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!ok(from) || !ok(to)) return { error: "Choose the from and to dates" };
  if (from > to) return { error: "The from date is after the to date" };
  const days = (dateKeyToDb(to).getTime() - dateKeyToDb(from).getTime()) / 86400000 + 1;
  if (days > MAX_STATEMENT_DAYS) return { error: "Choose at most one year" };
  return { from, to };
}

export async function salaryStatement(businessId: string, employeeId: string, from: string, to: string, showBank: boolean): Promise<Statement> {
  const e = await db.employee.findFirstOrThrow({ where: { id: employeeId, businessId }, include: { site: true, business: true } });
  const fromDb = dateKeyToDb(from);
  const toDb = dateKeyToDb(to);

  // Attendance, month by month (same rules as everywhere else, including the employee's shift).
  const months: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m, 1)) months.push(m);
  const perMonth = await Promise.all(months.map((m) => monthAttendance(businessId, m, [e])));
  const derived: DayResult[] = perMonth.flatMap((r) => r.days.get(e.id) ?? []).filter((d) => d.date >= from && d.date <= to);

  const [rates, advances, payments, adjustments, shifts, hisaab] = await Promise.all([
    db.wageChange.findMany({ where: { employeeId }, orderBy: { effectiveFrom: "asc" } }),
    db.advance.findMany({ where: { employeeId, status: { in: ["ACTIVE", "CLEARED"] }, givenOn: { gte: fromDb, lte: toDb } }, orderBy: { givenOn: "asc" } }),
    db.salaryPayment.findMany({ where: { employeeId, voidedAt: null, paidOn: { gte: fromDb, lte: toDb } }, orderBy: { paidOn: "asc" } }),
    db.adjustment.findMany({ where: { employeeId, onDate: { gte: fromDb, lte: toDb } }, orderBy: { onDate: "asc" } }),
    shiftsOf([employeeId]),
    hisaabOf(e),
  ]);
  const wage: WageRate[] = rates.map((r) => ({ effectiveFrom: dbToDateKey(r.effectiveFrom), wageType: r.wageType, monthlyWage: r.monthlyWage, dailyWage: r.dailyWage, cashWage: r.cashWage }));
  if (wage.length === 0) wage.push({ effectiveFrom: dbToDateKey(e.joinedOn), wageType: e.wageType, monthlyWage: e.monthlyWage, dailyWage: e.dailyWage, cashWage: e.cashWage });

  const counts: Statement["counts"] = { present: 0, halfDays: 0, absent: 0, paidLeave: 0, unpaidLeave: 0, weeklyOff: 0, holidays: 0, lateDays: 0, lateMins: 0, earlyDays: 0, earlyMins: 0, missingOut: 0, payableDays: 0, workedMins: 0 };
  const bankByMonth = new Map<string, number>();
  let gross = 0;
  let bankGross = 0;
  const days: StatementDay[] = derived.map((d) => {
    const r = wageOn(wage, d.date)!;
    const factor = dayFactor(d.status, r.wageType);
    const pay = factor * dayRate(r, daysInMonth(d.date.slice(0, 7)));
    const bank = pay * bankShare(r);
    gross += pay;
    bankGross += bank;
    bankByMonth.set(d.date.slice(0, 7), (bankByMonth.get(d.date.slice(0, 7)) ?? 0) + bank);
    counts.payableDays += factor;
    counts.workedMins += d.workedMins;
    if (d.status === "PRESENT") counts.present++;
    if (d.status === "HALF_DAY") counts.halfDays++;
    if (d.status === "ABSENT") counts.absent++;
    if (d.status === "PAID_LEAVE") counts.paidLeave++;
    if (d.status === "UNPAID_LEAVE") counts.unpaidLeave++;
    if (d.status === "WEEKLY_OFF") counts.weeklyOff++;
    if (d.status === "HOLIDAY") counts.holidays++;
    if (d.late) {
      counts.lateDays++;
      counts.lateMins += d.lateMins;
    }
    if (d.early) {
      counts.earlyDays++;
      counts.earlyMins += d.earlyMins;
    }
    if (d.missingOut && !d.overridden) counts.missingOut++;
    return {
      date: d.date,
      weekday: WEEKDAYS[weekday(d.date)],
      status: d.status === "FUTURE" ? "" : d.status === "NOT_EMPLOYED" ? "Not employed" : STATUS_LABEL[d.status] + (d.auto ? " (in-house)" : ""),
      inTime: d.inAt ? formatIstTime(d.inAt) : null,
      outTime: d.outAt ? formatIstTime(d.outAt) : null,
      workedMins: d.workedMins,
      lateMins: d.late ? d.lateMins : 0,
      earlyMins: d.early ? d.earlyMins : 0,
      missingOut: d.missingOut && !d.overridden,
      manual: d.overridden,
      factor,
      pay: Math.round(pay),
    };
  });
  // 30-day month: each whole month inside the range on a monthly salary pays the full salary
  // (same rule as the ledger, see monthDaysAdjustment). Part months are paid day by day.
  let monthAdjust = 0;
  for (const m of months) {
    const inMonth = derived.filter((d) => d.date.slice(0, 7) === m);
    if (!inMonth.length) continue;
    const dim = daysInMonth(m);
    let full = inMonth.length === dim;
    let paid = 0;
    let last: WageRate | null = null;
    for (const d of inMonth) {
      const r = wageOn(wage, d.date)!;
      if (d.status === "NOT_EMPLOYED" || d.status === "FUTURE" || r.wageType !== "MONTHLY") full = false;
      if (r.wageType === "MONTHLY") {
        last = r;
        paid += dayFactor(d.status, r.wageType);
      }
    }
    if (!last) continue;
    const adj = monthDaysAdjustment(dim, paid, full);
    if (!adj) continue;
    const pay = adj * dayRate(last);
    monthAdjust += pay;
    gross += pay;
    bankGross += pay * bankShare(last);
    bankByMonth.set(m, (bankByMonth.get(m) ?? 0) + pay * bankShare(last));
    counts.payableDays += adj;
  }
  monthAdjust = Math.round(monthAdjust);
  gross = Math.round(gross);
  bankGross = Math.min(gross, Math.round(bankGross));
  let pf = 0;
  let esi = 0;
  for (const bank of bankByMonth.values()) {
    const st = statutory(e, Math.round(bank), e.business);
    pf += st.pfEmployee;
    esi += st.esiEmployee;
  }

  const entries: StatementEntry[] = [
    ...advances.map((a) => ({ date: dbToDateKey(a.givenOn), kind: "Advance" as const, amount: a.amount, note: a.note ?? "" })),
    ...payments.map((p) => ({ date: dbToDateKey(p.paidOn), kind: "Payment" as const, amount: p.amount, note: [p.mode, p.ref, p.note].filter(Boolean).join(" · ") })),
    ...adjustments.map((a) => ({ date: dbToDateKey(a.onDate), kind: a.amount >= 0 ? ("Extra pay" as const) : ("Deduction" as const), amount: Math.abs(a.amount), note: a.reason ?? "" })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const sum = (k: StatementEntry["kind"]) => entries.filter((x) => x.kind === k).reduce((s, x) => s + x.amount, 0);
  const earned = gross - pf - esi;
  const extras = sum("Extra pay");
  const deductions = sum("Deduction");
  const adv = sum("Advance");
  const paid = sum("Payment");
  const total = e.wageType === "MONTHLY" ? e.monthlyWage : e.dailyWage;
  const shift = shifts.get(e.id);

  return {
    business: e.business.name,
    generatedOn: istDateKey(new Date()),
    from,
    to,
    employee: {
      name: e.name,
      code: e.code,
      site: e.site.name,
      shift: shift?.name ?? "Business hours",
      phone: e.phone,
      joinedOn: dbToDateKey(e.joinedOn),
      wageType: e.wageType,
      wage: total,
      bankWage: total - Math.min(e.cashWage, total),
      cashWage: Math.min(e.cashWage, total),
      pf: e.pfEnabled,
      esi: e.esiEnabled,
      uan: e.uanNumber,
      esic: e.esicNumber,
      bank: showBank && (e.bankAccountNumber || e.upiId) ? { name: e.bankAccountName, account: e.bankAccountNumber, ifsc: e.bankIfsc, bankName: e.bankName, upi: e.upiId } : null,
    },
    days,
    counts,
    money: { gross, monthAdjust, bankGross, cashGross: gross - bankGross, pf, esi, earned, extras, deductions, advances: adv, payments: paid, net: earned + extras - deductions - adv - paid, balanceToday: hisaab.balance },
    entries,
  };
}
