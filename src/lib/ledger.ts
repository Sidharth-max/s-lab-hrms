import "server-only";
import type { Employee, Prisma } from "@prisma/client";
import { deriveMonth, type PunchInput, type OverrideInput } from "./attendance";
import { db } from "./db";
import { effectiveWeeklyOff, parseDayRules } from "./day-rules";
import { bankShare, dayFactor, dayRate, monthDaysAdjustment, statutory, wageOn, type WageRate } from "./payroll";
import { leaveDays, shiftsOf } from "./services";
import { addMonths, dateKeyToDb, daysInMonth, dbToDateKey, istDateKey } from "./time";

// The salary "hisaab": one running balance per employee, no salary months and no locking.
//   balance = salary earned since joining (each day at that day's rate, PF/ESIC taken off)
//           + extra pay - deductions - advances given - salary paid
// Positive = the business owes the employee. Negative = the employee owes (advance more than earned).
//
// Bank and cash: each day's pay is split by the employee's bank / cash share on that date. PF and
// ESIC come only from the bank part. "Bank to pay" = bank part - PF - ESIC - payments made by bank /
// UPI / cheque. "Cash to pay" = cash part + extra pay - deductions - advances - cash payments.
// Bank to pay + cash to pay = balance.

type Tx = Prisma.TransactionClient;

export interface HisaabMonth {
  month: string; // only to show how the total was worked out
  payableDays: number;
  gross: number;
  pf: number;
  esi: number;
  net: number;
  bankGross: number; // part of gross paid through the bank (PF / ESIC worked out on this)
  cashGross: number;
}

export interface HisaabEntry {
  id: string;
  kind: "advance" | "payment" | "extra" | "deduction";
  date: string;
  amount: number; // paise, always positive; kind says which way it goes
  note: string | null;
  mode?: string | null;
  ref?: string | null;
  pending?: boolean; // advance waiting for approval: not taken off yet
  status?: string;
}

export interface Hisaab {
  employeeId: string;
  since: string; // joining date
  upTo: string; // today, or the last working day
  gross: number;
  pf: number;
  esi: number;
  earned: number; // gross - pf - esi
  extras: number; // extra pay minus deductions (signed)
  advances: number;
  payments: number;
  balance: number;
  /** Earned through the bank (bank gross - PF - ESIC) and in cash. */
  bankGross: number;
  cashGross: number;
  /** balance split: still to pay by bank, and in cash (can be negative). bankBalance + cashBalance = balance. */
  bankBalance: number;
  cashBalance: number;
  pendingAdvances: number;
  lastPaidOn: string | null;
  months: HisaabMonth[];
  entries: HisaabEntry[];
}

type Emp = Pick<
  Employee,
  "id" | "businessId" | "joinedOn" | "leftOn" | "customWeeklyOff" | "weeklyOffDays" | "inHouse" | "wageType" | "monthlyWage" | "dailyWage" | "cashWage" | "basicPercent" | "pfEnabled" | "esiEnabled"
>;

function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m, 1)) out.push(m);
  return out;
}

function group<T>(rows: T[], key: (r: T) => string) {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

/** Hisaab for many employees at once (one set of queries for the whole period). */
export async function hisaabFor(businessId: string, employees: Emp[], tx: Tx = db): Promise<Map<string, Hisaab>> {
  const result = new Map<string, Hisaab>();
  if (employees.length === 0) return result;
  const today = istDateKey(new Date());
  const span = new Map(
    employees.map((e) => {
      const since = dbToDateKey(e.joinedOn);
      const left = e.leftOn ? dbToDateKey(e.leftOn) : null;
      return [e.id, { since, upTo: left && left < today ? left : today }];
    }),
  );
  const ids = employees.map((e) => e.id);
  const starts = [...span.values()].map((s) => s.since).sort();
  const ends = [...span.values()].map((s) => s.upTo).sort();
  const from = dateKeyToDb(starts[0]);
  const to = dateKeyToDb(ends[ends.length - 1]);

  const [business, holidays, punches, overrides, plans, rates, advances, payments, adjustments, shifts] = await Promise.all([
    tx.business.findUniqueOrThrow({ where: { id: businessId } }),
    tx.holiday.findMany({ where: { businessId, date: { gte: from, lte: to } }, select: { date: true } }),
    tx.attendancePunch.findMany({ where: { employeeId: { in: ids }, workDate: { gte: from, lte: to }, voidedAt: null }, select: { employeeId: true, type: true, at: true, workDate: true } }),
    tx.dayOverride.findMany({ where: { employeeId: { in: ids }, workDate: { gte: from, lte: to } }, select: { employeeId: true, workDate: true, status: true, createdAt: true } }),
    tx.leavePlan.findMany({ where: { employeeId: { in: ids }, status: "ACTIVE", fromDate: { lte: to }, toDate: { gte: from } }, select: { employeeId: true, fromDate: true, toDate: true, paid: true } }),
    tx.wageChange.findMany({ where: { employeeId: { in: ids } }, orderBy: { effectiveFrom: "asc" } }),
    tx.advance.findMany({ where: { employeeId: { in: ids }, status: { in: ["ACTIVE", "CLEARED", "PENDING_APPROVAL"] } } }),
    tx.salaryPayment.findMany({ where: { employeeId: { in: ids }, voidedAt: null } }),
    tx.adjustment.findMany({ where: { employeeId: { in: ids } } }),
    shiftsOf(ids, tx),
  ]);

  const rules = {
    weeklyOffDays: business.weeklyOffDays,
    holidays: new Set(holidays.map((h) => dbToDateKey(h.date))),
    halfDayBelowMins: business.halfDayBelowMins,
    byWeekday: parseDayRules(business.dayRules),
  };
  const punchBy = group(punches, (p) => `${p.employeeId}|${dbToDateKey(p.workDate).slice(0, 7)}`);
  const overrideBy = group(overrides, (o) => `${o.employeeId}|${dbToDateKey(o.workDate).slice(0, 7)}`);
  const planBy = group(plans, (p) => p.employeeId);
  const rateBy = group(rates, (r) => r.employeeId);
  const advBy = group(advances, (a) => a.employeeId);
  const payBy = group(payments, (p) => p.employeeId);
  const adjBy = group(adjustments, (a) => a.employeeId);

  for (const e of employees) {
    const { since, upTo } = span.get(e.id)!;
    const wage: WageRate[] = (rateBy.get(e.id) ?? []).map((r) => ({ effectiveFrom: dbToDateKey(r.effectiveFrom), wageType: r.wageType, monthlyWage: r.monthlyWage, dailyWage: r.dailyWage, cashWage: r.cashWage }));
    if (wage.length === 0) wage.push({ effectiveFrom: since, wageType: e.wageType, monthlyWage: e.monthlyWage, dailyWage: e.dailyWage, cashWage: e.cashWage });
    const leaves = leaveDays(planBy.get(e.id) ?? []);
    const ctx = { today, joinedOn: since, leftOn: e.leftOn ? dbToDateKey(e.leftOn) : null, inHouse: e.inHouse };
    const shift = shifts.get(e.id);
    const dayRules = { ...rules, weeklyOffDays: effectiveWeeklyOff(business, e, shift), byWeekday: shift?.dayRules ?? rules.byWeekday };

    const months: HisaabMonth[] = [];
    if (since <= upTo) {
      for (const m of monthsBetween(since, upTo)) {
        const p: PunchInput[] = (punchBy.get(`${e.id}|${m}`) ?? []).map((x) => ({ type: x.type, at: x.at, workDate: dbToDateKey(x.workDate) }));
        const o: OverrideInput[] = (overrideBy.get(`${e.id}|${m}`) ?? []).map((x) => ({ workDate: dbToDateKey(x.workDate), status: x.status, createdAt: x.createdAt }));
        const dim = daysInMonth(m);
        let gross = 0;
        let bankGross = 0;
        let payableDays = 0;
        // 30-day month: a whole month on a monthly salary pays the full salary (see monthDaysAdjustment).
        let fullMonth = true;
        let monthlyPaid = 0;
        let lastMonthly: WageRate | null = null;
        for (const d of deriveMonth(m, p, o, dayRules, ctx, leaves)) {
          const r = wageOn(wage, d.date)!;
          if (d.status === "NOT_EMPLOYED" || d.status === "FUTURE" || r.wageType !== "MONTHLY") fullMonth = false;
          if (r.wageType === "MONTHLY") lastMonthly = r;
          const f = dayFactor(d.status, r.wageType);
          if (f === 0) continue;
          payableDays += f;
          if (r.wageType === "MONTHLY") monthlyPaid += f;
          const pay = f * dayRate(r, dim);
          gross += pay;
          bankGross += pay * bankShare(r);
        }
        if (lastMonthly) {
          const adj = monthDaysAdjustment(dim, monthlyPaid, fullMonth);
          if (adj) {
            const pay = adj * dayRate(lastMonthly);
            gross += pay;
            bankGross += pay * bankShare(lastMonthly);
            payableDays += adj;
          }
        }
        gross = Math.round(gross);
        bankGross = Math.min(gross, Math.round(bankGross));
        if (gross === 0 && payableDays === 0) continue;
        // PF and ESIC on the bank part only (the cash part has none).
        const st = statutory(e, bankGross, business);
        months.push({ month: m, payableDays, gross, pf: st.pfEmployee, esi: st.esiEmployee, net: gross - st.pfEmployee - st.esiEmployee, bankGross, cashGross: gross - bankGross });
      }
    }

    const entries: HisaabEntry[] = [
      ...(advBy.get(e.id) ?? []).map((a) => ({ id: a.id, kind: "advance" as const, date: dbToDateKey(a.givenOn), amount: a.amount, note: a.note, pending: a.status === "PENDING_APPROVAL", status: a.status })),
      ...(payBy.get(e.id) ?? []).map((p) => ({ id: p.id, kind: "payment" as const, date: dbToDateKey(p.paidOn), amount: p.amount, note: p.note, mode: p.mode, ref: p.ref })),
      ...(adjBy.get(e.id) ?? []).map((a) => ({ id: a.id, kind: a.amount >= 0 ? ("extra" as const) : ("deduction" as const), date: dbToDateKey(a.onDate), amount: Math.abs(a.amount), note: a.reason })),
    ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const sum = (list: HisaabEntry[]) => list.reduce((s, x) => s + x.amount, 0);
    const gross = months.reduce((s, m) => s + m.gross, 0);
    const pf = months.reduce((s, m) => s + m.pf, 0);
    const esi = months.reduce((s, m) => s + m.esi, 0);
    const earned = gross - pf - esi;
    const extras = sum(entries.filter((x) => x.kind === "extra")) - sum(entries.filter((x) => x.kind === "deduction"));
    const adv = sum(entries.filter((x) => x.kind === "advance" && !x.pending));
    const pendingAdvances = sum(entries.filter((x) => x.kind === "advance" && x.pending));
    const paid = sum(entries.filter((x) => x.kind === "payment"));
    const paidCash = sum(entries.filter((x) => x.kind === "payment" && (x.mode ?? "CASH") === "CASH"));
    const bankGross = months.reduce((s, m) => s + m.bankGross, 0);
    const cashGross = gross - bankGross;
    const lastPaid = entries.find((x) => x.kind === "payment");
    result.set(e.id, {
      employeeId: e.id,
      since,
      upTo,
      gross,
      pf,
      esi,
      earned,
      extras,
      advances: adv,
      payments: paid,
      balance: earned + extras - adv - paid,
      bankGross,
      cashGross,
      bankBalance: bankGross - pf - esi - (paid - paidCash),
      cashBalance: cashGross + extras - adv - paidCash,
      pendingAdvances,
      lastPaidOn: lastPaid?.date ?? null,
      months: months.reverse(),
      entries,
    });
  }
  return result;
}

export async function hisaabOf(employee: Emp, tx: Tx = db): Promise<Hisaab> {
  return (await hisaabFor(employee.businessId, [employee], tx)).get(employee.id)!;
}

/** Records a salary rate that applies from a date (replaces a change already on that date). */
export async function setWageFrom(
  employeeId: string,
  effectiveFrom: string,
  rate: { wageType: "MONTHLY" | "DAILY"; monthlyWage: number; dailyWage: number; cashWage?: number },
  actorId: string | null,
  tx: Tx = db,
) {
  const at = dateKeyToDb(effectiveFrom);
  await tx.wageChange.upsert({
    where: { employeeId_effectiveFrom: { employeeId, effectiveFrom: at } },
    create: { employeeId, effectiveFrom: at, ...rate, createdBy: actorId },
    update: { ...rate, createdBy: actorId },
  });
}
