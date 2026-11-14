// Per-weekday schedule set in Settings. Stored as JSON on Business.dayRules (index 0 = Sunday).

export interface DayRule {
  open: string; // "HH:MM" opening time: arrival time for staff
  close: string; // "HH:MM" closing time
  /**
   * Kept for older saved settings only. Half day is now decided by the middle of the shift
   * (shiftMiddle): punched in after it, or punched out before it.
   */
  halfDayBelowMins: number;
  anyScanFullDay: boolean; // any scan on this day counts as a full day (short days like Sunday)
  graceMins: number; // first scan-in later than open + grace = "Late" (a tag only, full pay)
  graceOutMins: number; // last scan-out earlier than close - grace = "Left early" (a tag only, full pay)
}

export const DEFAULT_DAY_RULE: DayRule = { open: "09:00", close: "18:00", halfDayBelowMins: 240, anyScanFullDay: false, graceMins: 0, graceOutMins: 0 };

const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Working minutes from open to close (a close at or before open means the day ends after midnight). */
export function shiftMinutes(rule: Pick<DayRule, "open" | "close">) {
  const span = mins(rule.close) - mins(rule.open);
  return span > 0 ? span : span + 1440;
}

/** Half of the day's working minutes (9:00-18:00 = 4 h 30 min). */
export function halfDayLimit(rule: Pick<DayRule, "open" | "close">) {
  return Math.floor(shiftMinutes(rule) / 2);
}

/**
 * Middle of the shift as "HH:MM": punching in after it, or out before it, makes a half day
 * (10:00-18:00 -> 14:00).
 */
export function shiftMiddle(rule: Pick<DayRule, "open" | "close">) {
  const m = (mins(rule.open) + Math.floor(shiftMinutes(rule) / 2)) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minutes after midnight (IST) from which a first scan-in counts as late: open + grace. */
export function lateAfterMinutes(rule: Pick<DayRule, "open" | "graceMins">) {
  return mins(rule.open) + rule.graceMins;
}

/** Minutes after midnight (IST) before which a last scan-out counts as leaving early: close - grace. */
export function earlyBeforeMinutes(rule: Pick<DayRule, "close" | "graceOutMins">) {
  return mins(rule.close) - rule.graceOutMins;
}

/** Defaults: Monday to Saturday 9 to 6, Sunday a short day until 3 pm where any scan is a full day. */
export function defaultDayRules(): DayRule[] {
  return Array.from({ length: 7 }, (_, i) =>
    i === 0 ? { open: "09:00", close: "15:00", halfDayBelowMins: 0, anyScanFullDay: true, graceMins: 0, graceOutMins: 0 } : { ...DEFAULT_DAY_RULE },
  );
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Reads the stored JSON safely; anything missing or broken falls back to the defaults. */
export function parseDayRules(value: unknown): DayRule[] {
  const defaults = defaultDayRules();
  if (!Array.isArray(value)) return defaults;
  return defaults.map((d, i) => {
    const v = value[i] as Partial<DayRule> | undefined;
    if (!v || typeof v !== "object") return d;
    return {
      open: typeof v.open === "string" && TIME.test(v.open) ? v.open : d.open,
      close: typeof v.close === "string" && TIME.test(v.close) ? v.close : d.close,
      halfDayBelowMins:
        typeof v.halfDayBelowMins === "number" && v.halfDayBelowMins >= 0 && v.halfDayBelowMins <= 720 ? Math.round(v.halfDayBelowMins) : d.halfDayBelowMins,
      anyScanFullDay: typeof v.anyScanFullDay === "boolean" ? v.anyScanFullDay : d.anyScanFullDay,
      graceMins: typeof v.graceMins === "number" && v.graceMins >= 0 && v.graceMins <= 240 ? Math.round(v.graceMins) : 0,
      graceOutMins: typeof v.graceOutMins === "number" && v.graceOutMins >= 0 && v.graceOutMins <= 240 ? Math.round(v.graceOutMins) : 0,
    };
  });
}

export function isTime(s: string) {
  return TIME.test(s);
}

/**
 * Weekly off days that apply to one employee: their own if set, otherwise their shift's,
 * otherwise the business default.
 */
export function effectiveWeeklyOff(
  business: { weeklyOffDays: number[] },
  employee: { customWeeklyOff: boolean; weeklyOffDays: number[] },
  shift?: { weeklyOffDays: number[] } | null,
): number[] {
  if (employee.customWeeklyOff) return employee.weeklyOffDays;
  return shift ? shift.weeklyOffDays : business.weeklyOffDays;
}

/** Reads the per-weekday form fields (open_i, close_i, grace_i, graceout_i, any_i, off_i) used by Settings and the shift editor. */
export function readDayRulesForm(get: (key: string) => string, isOn: (key: string) => boolean): { dayRules: DayRule[]; weeklyOffDays: number[] } | { error: string } {
  const weeklyOffDays: number[] = [];
  const dayRules: DayRule[] = [];
  for (let i = 0; i < 7; i++) {
    const open = get(`open_${i}`);
    const close = get(`close_${i}`);
    if (!isTime(open) || !isTime(close)) return { error: "Enter start and end times as HH:MM" };
    const grace = Number(get(`grace_${i}`) || "0");
    const graceOut = Number(get(`graceout_${i}`) || "0");
    if (![grace, graceOut].every((g) => Number.isInteger(g) && g >= 0 && g <= 240)) return { error: "Grace period must be 0 to 240 minutes" };
    if (isOn(`off_${i}`)) weeklyOffDays.push(i);
    dayRules.push({ open, close, halfDayBelowMins: halfDayLimit({ open, close }), anyScanFullDay: isOn(`any_${i}`), graceMins: grace, graceOutMins: graceOut });
  }
  return { dayRules, weeklyOffDays };
}
