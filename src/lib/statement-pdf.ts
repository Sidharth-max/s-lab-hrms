import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { formatDateKey } from "./time";
import type { Statement } from "./statement";

// Salary statement as a PDF (A4): header, employee details, attendance summary, the day-by-day
// attendance ledger, then the salary breakdown and the money entries of the period.
// Uses the built-in Helvetica font, so "Rs" is written instead of the rupee sign.

const W = 595.28;
const H = 841.89;
const M = 36; // page margin
const BRAND = rgb(0.29, 0.24, 1); // #4a3cff
const INK = rgb(0.07, 0.07, 0.09);
const MUTED = rgb(0.42, 0.44, 0.5);
const LINE = rgb(0.88, 0.89, 0.92);
const SOFT = rgb(0.96, 0.96, 0.98);
const RED = rgb(0.82, 0.15, 0.2);
const GREEN = rgb(0.05, 0.55, 0.3);

/** Helvetica only has Latin-1 characters: anything else (e.g. Hindi letters) becomes "?". */
function clean(s: string) {
  return s.replace(/[   ]/g, " ").replace(/[–—]/g, "-").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

export function rsText(paise: number) {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.round(Math.abs(paise));
  return `${sign}Rs ${new Intl.NumberFormat("en-IN").format(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, "0")}`;
}

export function minsText(m: number) {
  if (!m) return "";
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

const days = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export async function statementPdf(s: Statement): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(`Salary statement - ${s.employee.name} - ${s.from} to ${s.to}`));
  doc.setAuthor(clean(s.business));
  doc.setCreator("S-Lab HRMS");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const text = (t: string, x: number, yy: number, o: { size?: number; f?: PDFFont; color?: RGB; align?: "left" | "right" | "center"; width?: number } = {}) => {
    const size = o.size ?? 9;
    const f = o.f ?? font;
    let str = clean(t);
    // Cut text that does not fit its column.
    if (o.width && f.widthOfTextAtSize(str, size) > o.width) {
      while (str.length > 1 && f.widthOfTextAtSize(str + "..", size) > o.width) str = str.slice(0, -1);
      str += "..";
    }
    const w = f.widthOfTextAtSize(str, size);
    const xx = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    page.drawText(str, { x: xx, y: yy, size, font: f, color: o.color ?? INK });
  };
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const ensure = (h: number) => {
    if (y - h < M + 24) {
      newPage();
      return true;
    }
    return false;
  };
  const sectionTitle = (t: string) => {
    ensure(40);
    y -= 22;
    text(t, M, y, { size: 12, f: bold, color: BRAND });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: LINE });
    y -= 6;
  };

  // ---------- Header band ----------
  page.drawRectangle({ x: 0, y: H - 104, width: W, height: 104, color: BRAND });
  text(s.business, M, H - 40, { size: 11, f: bold, color: rgb(1, 1, 1) });
  text("Salary statement", M, H - 66, { size: 22, f: bold, color: rgb(1, 1, 1) });
  text(`${formatDateKey(s.from)} to ${formatDateKey(s.to)}`, M, H - 86, { size: 11, color: rgb(0.9, 0.9, 1) });
  text(`Made on ${formatDateKey(s.generatedOn)}`, W - M, H - 40, { size: 9, color: rgb(0.9, 0.9, 1), align: "right" });
  y = H - 104 - 10;

  // ---------- Employee details ----------
  const e = s.employee;
  const wageLine = `${rsText(e.wage)} ${e.wageType === "MONTHLY" ? "per month" : "per day"}` + (e.cashWage ? ` (bank ${rsText(e.bankWage)} + cash ${rsText(e.cashWage)})` : "");
  const details: [string, string][] = [
    ["Employee", `${e.name} (${e.code})`],
    ["Site", e.site],
    ["Shift", e.shift],
    ["Joined", formatDateKey(e.joinedOn)],
    ["Salary", wageLine],
    ["PF / ESIC", `${e.pf ? `PF on${e.uan ? ` (UAN ${e.uan})` : ""}` : "PF off"} · ${e.esi ? `ESIC on${e.esic ? ` (${e.esic})` : ""}` : "ESIC off"}`],
  ];
  if (e.phone) details.push(["Mobile", e.phone]);
  if (e.bank) {
    if (e.bank.account) details.push(["Bank", [e.bank.name, e.bank.account, e.bank.ifsc, e.bank.bankName].filter(Boolean).join(" · ")]);
    if (e.bank.upi) details.push(["UPI", e.bank.upi]);
  }
  sectionTitle("Employee");
  const colW = (W - 2 * M) / 2;
  // Two per row; a long value (salary, bank) takes a whole row.
  let col = 0;
  for (const [k, v] of details) {
    const full = k === "Salary" || k === "Bank";
    if (full || col === 0) {
      col = 0;
      y -= 26;
    }
    const x = M + col * colW;
    text(k.toUpperCase(), x, y + 11, { size: 7, f: bold, color: MUTED });
    text(v, x, y, { size: 10, width: full ? colW * 2 - 8 : colW - 8 });
    col = full ? 0 : (col + 1) % 2;
  }

  // ---------- Summary tiles ----------
  sectionTitle("Attendance summary");
  const c = s.counts;
  const tiles: [string, string, RGB?][] = [
    ["Present", days(c.present), GREEN],
    ["Half days", days(c.halfDays)],
    ["Absent", days(c.absent), c.absent ? RED : undefined],
    ["Paid leave", days(c.paidLeave)],
    ["Unpaid leave", days(c.unpaidLeave)],
    ["Weekly off / holiday", days(c.weeklyOff + c.holidays)],
    ["Late", c.lateDays ? `${c.lateDays} (${minsText(c.lateMins)})` : "0", c.lateDays ? RED : undefined],
    ["Left early", c.earlyDays ? `${c.earlyDays} (${minsText(c.earlyMins)})` : "0", c.earlyDays ? RED : undefined],
    ["Payable days", days(c.payableDays), BRAND],
    ["Hours worked", minsText(c.workedMins) || "0"],
  ];
  const tw = (W - 2 * M - 4 * 6) / 5;
  tiles.forEach(([k, v, color], i) => {
    const col = i % 5;
    if (col === 0) {
      ensure(48);
      y -= 46;
    }
    const x = M + col * (tw + 6);
    page.drawRectangle({ x, y, width: tw, height: 40, color: SOFT, borderColor: LINE, borderWidth: 0.6 });
    text(k, x + 8, y + 26, { size: 7.5, color: MUTED, width: tw - 12 });
    text(v, x + 8, y + 9, { size: 12, f: bold, color: color ?? INK, width: tw - 12 });
  });

  // ---------- Attendance ledger ----------
  sectionTitle("Attendance ledger");
  const cols: { t: string; w: number; align?: "right" | "center" }[] = [
    { t: "Date", w: 70 },
    { t: "Day", w: 30 },
    { t: "Status", w: 92 },
    { t: "In", w: 56 },
    { t: "Out", w: 56 },
    { t: "Worked", w: 52, align: "right" },
    { t: "Late", w: 48, align: "right" },
    { t: "Left early", w: 52, align: "right" },
    { t: "Pay", w: 0, align: "right" },
  ];
  cols[cols.length - 1].w = W - 2 * M - cols.reduce((a, x) => a + x.w, 0);
  const rowH = 15;
  const head = () => {
    page.drawRectangle({ x: M, y: y - rowH + 3, width: W - 2 * M, height: rowH, color: BRAND });
    let x = M;
    for (const col of cols) {
      const tx = col.align === "right" ? x + col.w - 5 : x + 5;
      text(col.t, tx, y - 8, { size: 8, f: bold, color: rgb(1, 1, 1), align: col.align === "right" ? "right" : "left" });
      x += col.w;
    }
    y -= rowH;
  };
  head();
  s.days.forEach((d, i) => {
    if (ensure(rowH)) head();
    if (i % 2 === 1) page.drawRectangle({ x: M, y: y - rowH + 3, width: W - 2 * M, height: rowH, color: SOFT });
    const off = d.status === "Weekly off" || d.status === "Holiday";
    const statusColor = d.status === "Absent" || d.status === "Unpaid leave" ? RED : d.status.startsWith("Present") ? GREEN : off ? MUTED : INK;
    const cells: [string, RGB?][] = [
      [formatDateKey(d.date)],
      [d.weekday, MUTED],
      [`${d.status}${d.manual ? " *" : ""}${d.missingOut ? " (no out)" : ""}`, statusColor],
      [d.inTime ?? "", d.lateMins ? RED : undefined],
      [d.outTime ?? "", d.earlyMins ? RED : undefined],
      [minsText(d.workedMins)],
      [d.lateMins ? minsText(d.lateMins) : "", RED],
      [d.earlyMins ? minsText(d.earlyMins) : "", RED],
      [d.pay ? rsText(d.pay) : "", d.pay ? INK : MUTED],
    ];
    let x = M;
    cells.forEach(([v, color], j) => {
      const col = cols[j];
      const tx = col.align === "right" ? x + col.w - 5 : x + 5;
      text(v, tx, y - 8, { size: 8, color, align: col.align === "right" ? "right" : "left", width: col.w - 8 });
      x += col.w;
    });
    y -= rowH;
  });
  ensure(14);
  y -= 12;
  text("* marked by hand. Late / Left early are tags only (no pay cut). Half day: in after or out before the middle of the shift.", M, y, { size: 7.5, color: MUTED });

  // ---------- Salary breakdown ----------
  sectionTitle("Salary breakdown");
  const m = s.money;
  const rows: [string, string, { strong?: boolean; color?: RGB; sub?: boolean }?][] = [
    ["Payable days", days(c.payableDays)],
    ["Salary earned (gross)", rsText(m.gross), { strong: true }],
    ...(m.cashGross > 0 ? ([["Bank part", rsText(m.bankGross), { sub: true }], ["Cash part", rsText(m.cashGross), { sub: true }]] as [string, string, { sub: boolean }][]) : []),
    ["PF (employee share, on bank part)", m.pf ? `- ${rsText(m.pf)}` : rsText(0), { color: m.pf ? RED : MUTED }],
    ["ESIC (employee share, on bank part)", m.esi ? `- ${rsText(m.esi)}` : rsText(0), { color: m.esi ? RED : MUTED }],
    ["Earned after PF / ESIC", rsText(m.earned), { strong: true }],
    ["Extra pay", m.extras ? `+ ${rsText(m.extras)}` : rsText(0), { color: m.extras ? GREEN : MUTED }],
    ["Deductions", m.deductions ? `- ${rsText(m.deductions)}` : rsText(0), { color: m.deductions ? RED : MUTED }],
    ["Advances given in this period", m.advances ? `- ${rsText(m.advances)}` : rsText(0), { color: m.advances ? RED : MUTED }],
    ["Salary paid in this period", m.payments ? `- ${rsText(m.payments)}` : rsText(0), { color: m.payments ? RED : MUTED }],
  ];
  for (const [k, v, o] of rows) {
    ensure(18);
    y -= 17;
    text(k, M + (o?.sub ? 14 : 0), y, { size: 10, f: o?.strong ? bold : font, color: o?.sub ? MUTED : INK });
    text(v, W - M, y, { size: 10, f: o?.strong ? bold : font, color: o?.color ?? INK, align: "right" });
    page.drawLine({ start: { x: M, y: y - 5 }, end: { x: W - M, y: y - 5 }, thickness: 0.4, color: LINE });
  }
  ensure(60);
  y -= 34;
  page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 30, color: BRAND });
  text(m.net >= 0 ? "Balance for this period (to pay)" : "Balance for this period (employee owes)", M + 10, y + 3, { size: 11, f: bold, color: rgb(1, 1, 1) });
  text(rsText(Math.abs(m.net)), W - M - 10, y + 3, { size: 13, f: bold, color: rgb(1, 1, 1), align: "right" });
  y -= 26;
  text(`Running ledger balance today (all time): ${m.balanceToday < 0 ? "employee owes " : ""}${rsText(Math.abs(m.balanceToday))}`, M, y, { size: 9, color: MUTED });

  // ---------- Entries ----------
  if (s.entries.length) {
    sectionTitle("Advances, payments and adjustments in this period");
    for (const x of s.entries) {
      ensure(16);
      y -= 15;
      text(formatDateKey(x.date), M, y, { size: 9 });
      text(x.kind, M + 80, y, { size: 9, f: bold, color: x.kind === "Extra pay" ? GREEN : x.kind === "Payment" ? BRAND : RED });
      text(x.note, M + 160, y, { size: 9, color: MUTED, width: W - 2 * M - 160 - 90 });
      text(rsText(x.amount), W - M, y, { size: 9, align: "right" });
    }
  }

  // ---------- Signature + page numbers ----------
  ensure(70);
  y -= 60;
  page.drawLine({ start: { x: M, y }, end: { x: M + 160, y }, thickness: 0.6, color: MUTED });
  page.drawLine({ start: { x: W - M - 160, y }, end: { x: W - M, y }, thickness: 0.6, color: MUTED });
  text("Employee signature", M, y - 12, { size: 8, color: MUTED });
  text("For " + s.business, W - M, y - 12, { size: 8, color: MUTED, align: "right" });

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    page = p;
    text(`${s.employee.name} · ${s.from} to ${s.to}`, M, 18, { size: 7.5, color: MUTED });
    text(`Page ${i + 1} of ${pages.length}`, W - M, 18, { size: 7.5, color: MUTED, align: "right" });
  });
  return doc.save();
}
