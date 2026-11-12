// Money arrives from the server in paise (integers).

function indianGroup(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

export function rs(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${sign}₹${indianGroup(rupees)}${rest ? "." + String(rest).padStart(2, "0") : ""}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Shift a YYYY-MM-DD date key by n days. */
export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function hours(mins: number): string {
  return mins ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m` : "—";
}
