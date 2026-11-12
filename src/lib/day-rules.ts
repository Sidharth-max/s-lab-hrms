// Per-weekday schedule set in Settings. Stored as JSON on Business.dayRules (index 0 = Sunday).

export interface DayRule {
  open: string; // "HH:MM" store opening time (shown to managers)
  close: string; // "HH:MM" store closing time
  halfDayBelowMins: number; // worked less than this = half day (0 = never half day)
  anyScanFullDay: boolean; // any scan on this day counts as a full day (short days like Sunday)
}

export const DEFAULT_DAY_RULE: DayRule = { open: "09:00", close: "18:00", halfDayBelowMins: 240, anyScanFullDay: false };

/** Defaults: Monday to Saturday 9 to 6, Sunday a short day until 3 pm where any scan is a full day. */
export function defaultDayRules(): DayRule[] {
  return Array.from({ length: 7 }, (_, i) =>
    i === 0 ? { open: "09:00", close: "15:00", halfDayBelowMins: 0, anyScanFullDay: true } : { ...DEFAULT_DAY_RULE },
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
    };
  });
}

export function isTime(s: string) {
  return TIME.test(s);
}

/** Weekly off days that apply to one employee: their own if set, otherwise the business default. */
export function effectiveWeeklyOff(
  business: { weeklyOffDays: number[] },
  employee: { customWeeklyOff: boolean; weeklyOffDays: number[] },
): number[] {
  return employee.customWeeklyOff ? employee.weeklyOffDays : business.weeklyOffDays;
}
