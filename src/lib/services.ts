import "server-only";
import type { Business, Employee, Prisma } from "@prisma/client";
import { countDays, deriveMonth, STATUS_LABEL, type DayResult } from "./attendance";
import { db } from "./db";
import { calculatePay, payableDays, grossPay, type AdvanceInput } from "./payroll";
import { effectiveWeeklyOff, parseDayRules } from "./day-rules";
import { daysInMonth, dbToDateKey, dateKeyToDb, istDateKey, istMonthKey, monthDates } from "./time";

type Tx = Prisma.TransactionClient;

export function monthRange(month: string) {
  const dates = monthDates(month);
  return { start: dateKeyToDb(dates[0]), end: dateKeyToDb(dates[dates.length - 1]) };
}

/** Employees who were employed for at least one day of the month. */
export function employedInMonthWhere(businessId: string, month: string): Prisma.EmployeeWhereInput {
  const { start, end } = monthRange(month);
  return { businessId, joinedOn: { lte: end }, OR: [{ leftOn: null }, { leftOn: { gte: start } }] };
}

export async function businessRules(businessId: string, month: string, tx: Tx = db) {
  const business = await tx.business.findUniqueOrThrow({ where: { id: businessId } });
  const { start, end } = monthRange(month);
  const holidays = await tx.holiday.findMany({ where: { businessId, date: { gte: start, lte: end } } });
  return {
    business,
    rules: {
      weeklyOffDays: business.weeklyOffDays,
      holidays: new Set(holidays.map((h) => dbToDateKey(h.date))),
      halfDayBelowMins: business.halfDayBelowMins,
      byWeekday: parseDayRules(business.dayRules),
    },
  };
}

export async function monthAttendance(
  businessId: string,
  month: string,
  employees: Pick<Employee, "id" | "joinedOn" | "leftOn" | "customWeeklyOff" | "weeklyOffDays" | "inHouse">[],
  tx: Tx = db,
): Promise<{ business: Business; days: Map<string, DayResult[]> }> {
  const { business, rules } = await businessRules(businessId, month, tx);
  const { start, end } = monthRange(month);
  const ids = employees.map((e) => e.id);
  const [punches, overrides] = await Promise.all([
    tx.attendancePunch.findMany({ where: { employeeId: { in: ids }, workDate: { gte: start, lte: end }, voidedAt: null } }),
    tx.dayOverride.findMany({ where: { employeeId: { in: ids }, workDate: { gte: start, lte: end } } }),
  ]);
  const today = istDateKey(new Date());
  const days = new Map<string, DayResult[]>();
  for (const e of employees) {
    days.set(
      e.id,
      deriveMonth(
        month,
        punches.filter((p) => p.employeeId === e.id).map((p) => ({ type: p.type, at: p.at, workDate: dbToDateKey(p.workDate) })),
        overrides.filter((o) => o.employeeId === e.id).map((o) => ({ workDate: dbToDateKey(o.workDate), status: o.status, createdAt: o.createdAt })),
        { ...rules, weeklyOffDays: effectiveWeeklyOff(business, e) },
        { today, joinedOn: dbToDateKey(e.joinedOn), leftOn: e.leftOn ? dbToDateKey(e.leftOn) : null, inHouse: e.inHouse },
      ),
    );
  }
  return { business, days };
}

/** Amount of each advance already recovered in LOCKED salary months. */
export async function recoveredByAdvance(advanceIds: string[], tx: Tx = db): Promise<Map<string, number>> {
  const rows = await tx.advanceRecovery.findMany({
    where: { advanceId: { in: advanceIds }, payrollLine: { run: { status: "LOCKED" } } },
    select: { advanceId: true, amount: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.advanceId, (map.get(r.advanceId) ?? 0) + r.amount);
  return map;
}

export async function outstandingAdvances(employeeId: string, tx: Tx = db) {
  const advances = await tx.advance.findMany({ where: { employeeId, status: { in: ["ACTIVE", "CLEARED"] } }, orderBy: { givenOn: "asc" } });
  const rec = await recoveredByAdvance(advances.map((a) => a.id), tx);
  return advances.map((a) => ({ ...a, recovered: rec.get(a.id) ?? 0, remaining: a.amount - (rec.get(a.id) ?? 0) }));
}

/** Salary earned so far this month (before deductions) minus all unrecovered advances. Negative = owes money. */
export async function employeeBalance(employee: Employee, tx: Tx = db) {
  const month = istMonthKey(new Date());
  const { days } = await monthAttendance(employee.businessId, month, [employee], tx);
  const counts = countDays(days.get(employee.id)!);
  const earned = grossPay(employee, payableDays(employee, counts), daysInMonth(month));
  const outstanding = (await outstandingAdvances(employee.id, tx)).reduce((s, a) => s + Math.max(0, a.remaining), 0);
  return { earned, outstanding, balance: earned - outstanding };
}

async function syncAdvanceStatuses(employeeIds: string[], tx: Tx) {
  const advances = await tx.advance.findMany({ where: { employeeId: { in: employeeIds }, status: { in: ["ACTIVE", "CLEARED"] } } });
  const rec = await recoveredByAdvance(advances.map((a) => a.id), tx);
  for (const a of advances) {
    const status = (rec.get(a.id) ?? 0) >= a.amount ? "CLEARED" : "ACTIVE";
    if (status !== a.status) await tx.advance.update({ where: { id: a.id }, data: { status } });
  }
}

/** (Re)build the draft salary sheet for a month. Locked months cannot be recalculated. */
export async function recalculatePayroll(businessId: string, month: string, tx: Tx) {
  const run = await tx.payrollRun.upsert({
    where: { businessId_month: { businessId, month } },
    create: { businessId, month },
    update: {},
  });
  if (run.status === "LOCKED") throw new Error("This month is locked");

  const employees = await tx.employee.findMany({ where: employedInMonthWhere(businessId, month), orderBy: { name: "asc" } });
  const { business, days } = await monthAttendance(businessId, month, employees, tx);
  const ids = employees.map((e) => e.id);
  const [adjustments, advances] = await Promise.all([
    tx.adjustment.findMany({ where: { employeeId: { in: ids }, month } }),
    tx.advance.findMany({ where: { employeeId: { in: ids }, status: { in: ["ACTIVE", "CLEARED"] }, startMonth: { lte: month } } }),
  ]);
  const rec = await recoveredByAdvance(advances.map((a) => a.id), tx);

  // Keep payment records when a reopened month is recalculated.
  const oldLines = await tx.payrollLine.findMany({ where: { runId: run.id } });
  const paid = new Map(oldLines.map((l) => [l.employeeId, l]));
  await tx.payrollLine.deleteMany({ where: { runId: run.id } });
  const dim = daysInMonth(month);
  for (const e of employees) {
    const advInputs: AdvanceInput[] = advances
      .filter((a) => a.employeeId === e.id)
      .map((a) => ({
        id: a.id,
        amount: a.amount,
        recoveryMonths: a.recoveryMonths,
        startMonth: a.startMonth,
        recoveredBefore: rec.get(a.id) ?? 0,
        givenOn: dbToDateKey(a.givenOn),
      }));
    const r = calculatePay({
      month,
      daysInMonth: dim,
      counts: countDays(days.get(e.id)!),
      employee: e,
      rates: business,
      adjustments: adjustments.filter((a) => a.employeeId === e.id).reduce((s, a) => s + a.amount, 0),
      advances: advInputs,
    });
    await tx.payrollLine.create({
      data: {
        runId: run.id,
        employeeId: e.id,
        wageType: e.wageType,
        rate: r.rate,
        daysInMonth: r.daysInMonth,
        payableDays: r.payableDays,
        presentDays: r.presentDays,
        paidOffDays: r.paidOffDays,
        gross: r.gross,
        adjustments: r.adjustments,
        pfEmployee: r.pfEmployee,
        pfEmployer: r.pfEmployer,
        esiEmployee: r.esiEmployee,
        esiEmployer: r.esiEmployer,
        advanceRecovered: r.advanceRecovered,
        net: r.net,
        paidAmount: paid.get(e.id)?.paidAmount ?? 0,
        paidOn: paid.get(e.id)?.paidOn ?? null,
        paymentMode: paid.get(e.id)?.paymentMode ?? null,
        paymentRef: paid.get(e.id)?.paymentRef ?? null,
        recoveries: { create: r.recoveries.map((x) => ({ advanceId: x.advanceId, amount: x.amount })) },
      },
    });
  }
  return tx.payrollRun.update({ where: { id: run.id }, data: { updatedAt: new Date() } });
}

export async function lockPayroll(businessId: string, month: string, actorId: string, tx: Tx) {
  const earlierDraft = await tx.payrollRun.findFirst({ where: { businessId, status: "DRAFT", month: { lt: month } } });
  if (earlierDraft) throw new Error(`Lock ${earlierDraft.month} first`);
  if (month > istMonthKey(new Date())) throw new Error("Cannot lock a future month");
  const run = await recalculatePayroll(businessId, month, tx);
  await tx.payrollRun.update({ where: { id: run.id }, data: { status: "LOCKED", lockedAt: new Date(), lockedBy: actorId } });
  const lines = await tx.payrollLine.findMany({ where: { runId: run.id }, select: { employeeId: true } });
  await syncAdvanceStatuses(lines.map((l) => l.employeeId), tx);
}

export async function reopenPayroll(businessId: string, month: string, tx: Tx) {
  const later = await tx.payrollRun.findFirst({ where: { businessId, status: "LOCKED", month: { gt: month } } });
  if (later) throw new Error(`Reopen ${later.month} first`);
  const run = await tx.payrollRun.findUniqueOrThrow({ where: { businessId_month: { businessId, month } } });
  await tx.payrollRun.update({ where: { id: run.id }, data: { status: "DRAFT", lockedAt: null, lockedBy: null } });
  const lines = await tx.payrollLine.findMany({ where: { runId: run.id }, select: { employeeId: true } });
  await syncAdvanceStatuses(lines.map((l) => l.employeeId), tx);
}

/** Next free employee code: E001, E002, … (one more than the highest E-number used, so codes never repeat). */
export async function nextEmployeeCode(businessId: string, tx: Tx = db): Promise<string> {
  const rows = await tx.employee.findMany({ where: { businessId, code: { startsWith: "E" } }, select: { code: true } });
  const max = rows.reduce((m, r) => {
    const n = /^E(\d+)$/.exec(r.code);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `E${String(max + 1).padStart(3, "0")}`;
}

/** Today's attendance for one employee, e.g. { status: "HALF_DAY", label: "Half day" }. */
export async function todayStatus(employee: Employee, tx: Tx = db) {
  const today = istDateKey(new Date());
  const { days } = await monthAttendance(employee.businessId, today.slice(0, 7), [employee], tx);
  const d = days.get(employee.id)?.find((x) => x.date === today);
  if (!d || d.status === "NOT_EMPLOYED" || d.status === "FUTURE") return null;
  // Absent so far today simply means they have not scanned in yet.
  return { status: d.status, label: d.status === "ABSENT" ? "Not in yet" : STATUS_LABEL[d.status] };
}
