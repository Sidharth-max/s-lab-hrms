// Money is kept in paise (integers). Rs 1 = 100 paise.

export function formatRs(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  const r = new Intl.NumberFormat("en-IN").format(rupees);
  return `${sign}₹${r}${rest ? "." + String(rest).padStart(2, "0") : ""}`;
}

/** Parse a rupee amount typed by a user ("1,500", "1500.50") into paise. Returns null if invalid. */
export function parseRs(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).replace(/[,₹\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

export function rsInput(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}
