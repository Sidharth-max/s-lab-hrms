// Turns raw punches and manual day decisions into a status for every day of a month.
// Pure functions: no database access, so they are unit tested.

import { monthDates, weekday } from "./time";
import { lateAfterMinutes, shiftMinutes } from "./day-rules";

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
  halfDayBelowMins: number; // used when a weekday has no rule of its own
  /** Optional per-weekday rules (index 0 = Sunday). With open/close the half-day limit is half the day's hours. */
  byWeekday?: { halfDayBelowMins: number; anyScanFullDay: boolean; open?: string; close?: string; graceMins?: number; graceOutMins?: number }[];
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
  /** In-house employee marked present automatically (no scan needed). */
  auto: boolean;
  /** First scan-in after opening time + grace (working days only, not in-house). A tag only: full pay. */
  late: boolean;
  lateMins: number;
  /** Last scan-out before closing time - grace out (working days only, not in-house). A tag only: full pay. */
  early: boolean;
  earlyMins: number;
}

/** IST minutes after midnight. */
function istMinutes(d: Date) {
  const ist = new Date(d.getTime() + 5.5 * 3600000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/**
 * Half day by the middle of the shift. Times are measured from opening time (a shift may end after
 * midnight); a scan a little before opening counts as early, not as next-day.
 */
export function isHalfByShift(firstIn: Date | null, lastOut: Date | null, open: string, close: string) {
  if (!firstIn) return false;
  const shift = shiftMinutes({ open, close });
  const mid = shift / 2;
  const openMin = Number(open.slice(0, 2)) * 60 + Number(open.slice(3, 5));
  const rel = (d: Date) => {
    let r = (istMinutes(d) - openMin + 1440) % 1440;
    if (r > (shift + 1440) / 2) r -= 1440; // before opening time
    return r;
  };
  if (rel(firstIn) > mid) return true; // came after half the shift was over
  if (lastOut && rel(lastOut) < mid) return true; // left before half the shift was done
  return false;
}

/** Minutes the last scan-out was before closing time minus the grace (0 = not early). Handles shifts past midnight. */
export function earlyMinutes(lastOut: Date, open: string, close: string, graceOutMins: number) {
  const shift = shiftMinutes({ open, close });
  const openMin = Number(open.slice(0, 2)) * 60 + Number(open.slice(3, 5));
  let rel = (istMinutes(lastOut) - openMin + 1440) % 1440;
  if (rel > (shift + 1440) / 2) rel -= 1440; // before opening time
  return Math.max(0, shift - graceOutMins - rel);
}

export function deriveDay(
  date: string,
  punches: PunchInput[],
  override: OverrideInput | undefined,
  rules: DayRules,
  ctx: { today: string; joinedOn: string; leftOn: string | null; inHouse?: boolean },
  leave?: "PAID_LEAVE" | "UNPAID_LEAVE",
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
  // In-house staff are not expected to scan out, so a missing OUT is not flagged for them.
  const missingOut = openIn !== null && !ctx.inHouse;
  // Late: first scan-in after open + grace on a working day (in-house staff are not expected to scan).
  const lateRule = rules.byWeekday?.[weekday(date)];
  let lateMins = 0;
  if (firstIn && !offDay && !ctx.inHouse && lateRule?.open) {
    const inMin = istMinutes(firstIn);
    lateMins = Math.max(0, inMin - lateAfterMinutes({ open: lateRule.open, graceMins: lateRule.graceMins ?? 0 }));
  }
  // Left early: last scan-out before close - grace out (only when they did not come back in).
  let earlyMins = 0;
  if (lastOut && !openIn && !offDay && !ctx.inHouse && lateRule?.open && lateRule.close && !lateRule.anyScanFullDay) {
    earlyMins = earlyMinutes(lastOut, lateRule.open, lateRule.close, lateRule.graceOutMins ?? 0);
  }
  const base = { date, inAt: firstIn, outAt: lastOut, workedMins, missingOut, offDay, auto: false, late: lateMins > 0, lateMins, early: earlyMins > 0, earlyMins };

  if (date < ctx.joinedOn || (ctx.leftOn && date > ctx.leftOn)) {
    return { ...base, status: "NOT_EMPLOYED", overridden: false };
  }
  if (override && override.status !== "AUTO") return { ...base, status: override.status, overridden: true };

  const dayRule = rules.byWeekday?.[weekday(date)];
  if (firstIn) {
    // In-house staff: any scan is a full day. Others: a missing OUT still counts as present (flagged
    // for the manager); short days (e.g. Sunday) can be set so that any scan is a full day.
    if (ctx.inHouse) return { ...base, status: "PRESENT", overridden: false };
    // Half day by the middle of the shift (open + 50% of open-to-close): punched in after it (more than
    // half the shift was already over) or punched out before it (left before half the shift was done).
    // Old rules without times fall back to "worked under the saved minutes".
    let half: boolean;
    if (dayRule?.anyScanFullDay) half = false;
    else if (dayRule?.open && dayRule.close) half = isHalfByShift(firstIn, missingOut ? null : lastOut, dayRule.open, dayRule.close);
    else {
      const halfBelow = dayRule ? dayRule.halfDayBelowMins : rules.halfDayBelowMins;
      half = !missingOut && halfBelow > 0 && workedMins < halfBelow;
    }
    return { ...base, status: half ? "HALF_DAY" : "PRESENT", overridden: false };
  }
  const offDayToday = rules.holidays.has(date) || rules.weeklyOffDays.includes(weekday(date));
  // Scheduled leave (also shown for future days). Weekly offs and holidays inside it stay off days.
  if (leave && !offDayToday) return { ...base, status: leave, overridden: false };
  if (date > ctx.today) return { ...base, status: "FUTURE", overridden: false };
  if (rules.holidays.has(date)) return { ...base, status: "HOLIDAY", overridden: false };
  if (rules.weeklyOffDays.includes(weekday(date))) return { ...base, status: "WEEKLY_OFF", overridden: false };
  // In-house: present automatically on working days without scanning.
  if (ctx.inHouse) return { ...base, status: "PRESENT", overridden: false, auto: true };
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
  ctx: { today: string; joinedOn: string; leftOn: string | null; inHouse?: boolean },
  /** Scheduled leave by date (from leave plans). */
  leaves?: Map<string, "PAID_LEAVE" | "UNPAID_LEAVE">,
): DayResult[] {
  const latest = latestOverrides(overrides);
  return monthDates(month).map((d) => deriveDay(d, punches, latest.get(d), rules, ctx, leaves?.get(d)));
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


/** Badge class for a status: present green, half day yellow, absent / unpaid leave red. */
export function statusBadgeClass(status: string): string {
  if (status === "PRESENT") return "badge badge-green";
  if (status === "HALF_DAY") return "badge badge-amber";
  if (status === "ABSENT" || status === "UNPAID_LEAVE") return "badge badge-red";
  return "badge badge-neutral";
}

/** "late 25m" / "late 1h 5m" for an arrival after opening time + grace. */
export function lateLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `late ${h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`}`;
}

/** "left 20m early" */
export function earlyLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `left ${h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`} early`;
}
