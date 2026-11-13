import "server-only";
import type { Business, Employee, Prisma } from "@prisma/client";
import { deriveMonth, STATUS_LABEL, type DayResult } from "./attendance";
import { db } from "./db";
import { effectiveWeeklyOff, parseDayRules } from "./day-rules";
import { dbToDateKey, dateKeyToDb, istDateKey, monthDates } from "./time";

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
  const [punches, overrides, plans] = await Promise.all([
    tx.attendancePunch.findMany({ where: { employeeId: { in: ids }, workDate: { gte: start, lte: end }, voidedAt: null } }),
    tx.dayOverride.findMany({ where: { employeeId: { in: ids }, workDate: { gte: start, lte: end } } }),
    tx.leavePlan.findMany({ where: { employeeId: { in: ids }, status: "ACTIVE", fromDate: { lte: end }, toDate: { gte: start } } }),
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
        leaveDays(plans.filter((p) => p.employeeId === e.id)),
      ),
    );
  }
  return { business, days };
}

/** Date -> leave type for a set of leave plans. */
export function leaveDays(plans: { fromDate: Date; toDate: Date; paid: boolean }[]) {
  const map = new Map<string, "PAID_LEAVE" | "UNPAID_LEAVE">();
  for (const p of plans) {
    for (let t = p.fromDate.getTime(); t <= p.toDate.getTime(); t += 86400000) {
      map.set(dbToDateKey(new Date(t)), p.paid ? "PAID_LEAVE" : "UNPAID_LEAVE");
    }
  }
  return map;
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
