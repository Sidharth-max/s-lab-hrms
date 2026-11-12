// Turns raw punches and manual day decisions into a status for every day of a month.
// Pure functions: no database access, so they are unit tested.

import { monthDates, weekday } from "./time";

export type DerivedStatus =
  | "PRESENT"
  | "HALF_DAY"
  | "ABSENT"
  | "PAID_LEAVE"
  | "UNPAID_LEAVE"
  | "WEEKLY_OFF"
  | "HOLIDAY"
  | "FUTURE"
  | "NOT_EMPLOYED";

export interface PunchInput {
  type: "IN" | "OUT";
  at: Date;
  workDate: string; // date key
}

export interface OverrideInput {
  workDate: string;
  status: "PRESENT" | "HALF_DAY" | "ABSENT" | "PAID_LEAVE" | "UNPAID_LEAVE" | "AUTO";
  createdAt: Date;
}

export interface DayRules {
  weeklyOffDays: number[];
  holidays: Set<string>;
  halfDayBelowMins: number;
}

export interface DayResult {
  date: string;
  status: DerivedStatus;
  inAt: Date | null;
  outAt: Date | null;
  workedMins: number;
  missingOut: boolean;
  overridden: boolean;
  offDay: boolean; // weekly off or holiday (worked or not)
}

export function deriveDay(
  date: string,
  punches: PunchInput[],
  override: OverrideInput | undefined,
  rules: DayRules,
  ctx: { today: string; joinedOn: string; leftOn: string | null },
): DayResult {
  const offDay = rules.holidays.has(date) || rules.weeklyOffDays.includes(weekday(date));
  const sorted = punches.filter((p) => p.workDate === date).sort((a, b) => a.at.getTime() - b.at.getTime());

  let workedMs = 0;
  let openIn: Date | null = null;
  let firstIn: Date | null = null;
  let lastOut: Date | null = null;
  for (const p of sorted) {
    if (p.type === "IN") {
      if (!openIn) openIn = p.at;
      if (!firstIn) firstIn = p.at;
    } else if (openIn) {
      workedMs += p.at.getTime() - openIn.getTime();
      lastOut = p.at;
      openIn = null;
    }
  }
  const workedMins = Math.round(workedMs / 60000);
  const missingOut = openIn !== null;
  const base = { date, inAt: firstIn, outAt: lastOut, workedMins, missingOut, offDay };

  if (date < ctx.joinedOn || (ctx.leftOn && date > ctx.leftOn)) {
    return { ...base, status: "NOT_EMPLOYED", overridden: false };
  }
  if (override && override.status !== "AUTO") return { ...base, status: override.status, overridden: true };

  if (firstIn) {
    // A missing OUT punch still counts as present; it is flagged for the manager to fix.
    const half = !missingOut && rules.halfDayBelowMins > 0 && workedMins < rules.halfDayBelowMins;
    return { ...base, status: half ? "HALF_DAY" : "PRESENT", overridden: false };
  }
  if (date > ctx.today) return { ...base, status: "FUTURE", overridden: false };
  if (rules.holidays.has(date)) return { ...base, status: "HOLIDAY", overridden: false };
  if (rules.weeklyOffDays.includes(weekday(date))) return { ...base, status: "WEEKLY_OFF", overridden: false };
  return { ...base, status: "ABSENT", overridden: false };
}

/** Newest override per date. */
export function latestOverrides(overrides: OverrideInput[]): Map<string, OverrideInput> {
  const map = new Map<string, OverrideInput>();
  for (const o of overrides) {
    const cur = map.get(o.workDate);
    if (!cur || o.createdAt > cur.createdAt) map.set(o.workDate, o);
  }
  return map;
}

export function deriveMonth(
  month: string,
  punches: PunchInput[],
  overrides: OverrideInput[],
  rules: DayRules,
  ctx: { today: string; joinedOn: string; leftOn: string | null },
): DayResult[] {
  const latest = latestOverrides(overrides);
  return monthDates(month).map((d) => deriveDay(d, punches, latest.get(d), rules, ctx));
}

export interface DayCounts {
  present: number; // full = 1, half = 0.5
  paidLeave: number;
  paidOff: number; // weekly offs + holidays not worked
  absent: number;
  unpaidLeave: number;
  missingOut: number;
  employedDays: number;
}

export function countDays(days: DayResult[]): DayCounts {
  const c: DayCounts = { present: 0, paidLeave: 0, paidOff: 0, absent: 0, unpaidLeave: 0, missingOut: 0, employedDays: 0 };
  for (const d of days) {
    if (d.status === "NOT_EMPLOYED") continue;
    c.employedDays++;
    if (d.missingOut && !d.overridden) c.missingOut++;
    switch (d.status) {
      case "PRESENT":
        c.present += 1;
        break;
      case "HALF_DAY":
        c.present += 0.5;
        break;
      case "PAID_LEAVE":
        c.paidLeave += 1;
        break;
      case "WEEKLY_OFF":
      case "HOLIDAY":
        c.paidOff += 1;
        break;
      case "ABSENT":
        c.absent += 1;
        break;
      case "UNPAID_LEAVE":
        c.unpaidLeave += 1;
        break;
    }
  }
  return c;
}

export const STATUS_LABEL: Record<DerivedStatus, string> = {
  PRESENT: "Present",
  HALF_DAY: "Half day",
  ABSENT: "Absent",
  PAID_LEAVE: "Paid leave",
  UNPAID_LEAVE: "Unpaid leave",
  WEEKLY_OFF: "Weekly off",
  HOLIDAY: "Holiday",
  FUTURE: "",
  NOT_EMPLOYED: "",
};

export const STATUS_SHORT: Record<DerivedStatus, string> = {
  PRESENT: "P",
  HALF_DAY: "H",
  ABSENT: "A",
  PAID_LEAVE: "PL",
  UNPAID_LEAVE: "UL",
  WEEKLY_OFF: "WO",
  HOLIDAY: "HO",
  FUTURE: "",
  NOT_EMPLOYED: "",
};

/**
 * Decide whether the next face scan is IN or OUT.
 * If the last valid punch is an IN within maxShiftHours, this scan closes it (works for night shifts).
 * A repeat scan within duplicateMins of the last punch is ignored.
 */
export function nextPunch(
  last: { type: "IN" | "OUT"; at: Date; workDate: string } | null,
  now: Date,
  todayKey: string,
  rules: { duplicateScanMins: number; maxShiftHours: number },
): { action: "duplicate" } | { action: "punch"; type: "IN" | "OUT"; workDate: string } {
  if (last && now.getTime() - last.at.getTime() < rules.duplicateScanMins * 60000) {
    return { action: "duplicate" };
  }
  if (last && last.type === "IN" && now.getTime() - last.at.getTime() <= rules.maxShiftHours * 3600000) {
    return { action: "punch", type: "OUT", workDate: last.workDate };
  }
  return { action: "punch", type: "IN", workDate: todayKey };
}
