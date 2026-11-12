// All business dates are Indian Standard Time (UTC+05:30, no daylight saving).
// A "date key" is "YYYY-MM-DD" in IST. A "month key" is "YYYY-MM".
// Postgres DATE columns are stored as UTC midnight of the IST calendar date.

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function istDateKey(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function istMonthKey(d: Date): string {
  return istDateKey(d).slice(0, 7);
}

/** Date key -> Date at UTC midnight, the value Prisma uses for @db.Date. */
export function dateKeyToDb(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error(`Bad date: ${key}`);
  return new Date(`${key}T00:00:00.000Z`);
}

/** Prisma @db.Date value -> date key. */
export function dbToDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "HH:MM" on an IST date -> absolute instant. */
export function istDateTime(dateKey: string, hhmm: string): Date {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) throw new Error(`Bad time: ${hhmm}`);
  return new Date(new Date(`${dateKey}T${hhmm}:00.000Z`).getTime() - IST_OFFSET_MS);
}

export function formatIstTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function isMonthKey(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthDates(month: string): string[] {
  const n = daysInMonth(month);
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** Weekday (0 = Sunday) of a date key. */
export function weekday(key: string): number {
  return dateKeyToDb(key).getUTCDay();
}

/** Whole months from a to b ("2026-01" -> "2026-03" = 2). */
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}
