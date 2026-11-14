import "server-only";
import ExcelJS from "exceljs";
import { formatDateKey } from "./time";
import type { Statement } from "./statement";

// Salary statement as an Excel workbook: one "Statement" sheet laid out like the PDF (details,
// attendance summary, salary breakdown), an "Attendance" sheet with one row per day, and an
// "Entries" sheet with the advances, payments and adjustments of the period.
// Amounts are real numbers in rupees (formatted ₹ #,##0.00) so they can be added up in Excel.

const BRAND = "FF4A3CFF";
const SOFT = "FFF4F4F8";
const RED = "FFD12632";
const GREEN = "FF0D8C4D";
const MUTED = "FF6B7080";
const RS = '"₹"#,##,##0.00';

const rupees = (paise: number) => Math.round(paise) / 100;
const mins = (m: number) => (m ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : "");

export async function statementXlsx(s: Statement): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "S-Lab HRMS";
  wb.created = new Date();
  const e = s.employee;
  const c = s.counts;
  const m = s.money;

  // ---------- Statement ----------
  const ws = wb.addWorksheet("Statement", { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ width: 38 }, { width: 22 }, { width: 4 }, { width: 26 }, { width: 18 }];
  const title = ws.addRow([s.business]);
  title.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  const t2 = ws.addRow(["Salary statement"]);
  t2.font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  const t3 = ws.addRow([`${formatDateKey(s.from)} to ${formatDateKey(s.to)}`, "", "", `Made on ${formatDateKey(s.generatedOn)}`]);
  t3.font = { size: 11, color: { argb: "FFE6E6FF" } };
  for (const r of [title, t2, t3]) {
    for (let i = 1; i <= 5; i++) r.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    r.height = r === t2 ? 28 : 18;
  }
  ws.addRow([]);

  const section = (name: string) => {
    const r = ws.addRow([name]);
    r.font = { bold: true, size: 12, color: { argb: BRAND } };
    r.getCell(1).border = { bottom: { style: "thin", color: { argb: BRAND } } };
    ws.mergeCells(r.number, 1, r.number, 5);
  };
  const pair = (k: string, v: string | number, opts: { money?: boolean; bold?: boolean; color?: string } = {}) => {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { color: { argb: MUTED }, bold: opts.bold };
    r.getCell(2).font = { bold: opts.bold, color: opts.color ? { argb: opts.color } : undefined };
    r.getCell(2).alignment = { horizontal: "right" };
    if (opts.money) r.getCell(2).numFmt = RS;
    return r;
  };

  section("Employee");
  pair("Name", `${e.name} (${e.code})`);
  pair("Site", e.site);
  pair("Shift", e.shift);
  pair("Joined", formatDateKey(e.joinedOn));
  pair(e.wageType === "MONTHLY" ? "Salary per month" : "Wage per day", rupees(e.wage), { money: true });
  if (e.cashWage) {
    pair("  Bank part", rupees(e.bankWage), { money: true });
    pair("  Cash part", rupees(e.cashWage), { money: true });
  }
  pair("PF", e.pf ? `On${e.uan ? ` · UAN ${e.uan}` : ""}` : "Off");
  pair("ESIC", e.esi ? `On${e.esic ? ` · ${e.esic}` : ""}` : "Off");
  if (e.phone) pair("Mobile", e.phone);
  if (e.bank?.account) pair("Bank account", [e.bank.name, e.bank.account, e.bank.ifsc, e.bank.bankName].filter(Boolean).join(" · "));
  if (e.bank?.upi) pair("UPI", e.bank.upi);
  ws.addRow([]);

  section("Attendance summary");
  pair("Present (full days)", c.present, { color: GREEN });
  pair("Half days", c.halfDays);
  pair("Absent", c.absent, { color: c.absent ? RED : undefined });
  pair("Paid leave", c.paidLeave);
  pair("Unpaid leave", c.unpaidLeave);
  pair("Weekly off", c.weeklyOff);
  pair("Holidays", c.holidays);
  pair("Late (days · total h:mm)", c.lateDays ? `${c.lateDays} · ${mins(c.lateMins)}` : "0", { color: c.lateDays ? RED : undefined });
  pair("Left early (days · total h:mm)", c.earlyDays ? `${c.earlyDays} · ${mins(c.earlyMins)}` : "0", { color: c.earlyDays ? RED : undefined });
  pair("No out punch", c.missingOut);
  pair("Hours worked (h:mm)", mins(c.workedMins) || "0");
  pair("Payable days", c.payableDays, { bold: true });
  ws.addRow([]);

  section("Salary breakdown");
  pair("Salary earned (gross)", rupees(m.gross), { money: true, bold: true });
  if (m.cashGross > 0) {
    pair("  Bank part", rupees(m.bankGross), { money: true });
    pair("  Cash part", rupees(m.cashGross), { money: true });
  }
  pair("PF (employee share, on bank part)", -rupees(m.pf), { money: true, color: m.pf ? RED : undefined });
  pair("ESIC (employee share, on bank part)", -rupees(m.esi), { money: true, color: m.esi ? RED : undefined });
  pair("Earned after PF / ESIC", rupees(m.earned), { money: true, bold: true });
  pair("Extra pay", rupees(m.extras), { money: true, color: m.extras ? GREEN : undefined });
  pair("Deductions", -rupees(m.deductions), { money: true, color: m.deductions ? RED : undefined });
  pair("Advances given in this period", -rupees(m.advances), { money: true, color: m.advances ? RED : undefined });
  pair("Salary paid in this period", -rupees(m.payments), { money: true, color: m.payments ? RED : undefined });
  const net = pair(m.net >= 0 ? "Balance for this period (to pay)" : "Balance for this period (employee owes)", rupees(Math.abs(m.net)), { money: true, bold: true });
  for (let i = 1; i <= 2; i++) {
    net.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    net.getCell(i).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  }
  pair("Running ledger balance today (all time)", rupees(m.balanceToday), { money: true });
  ws.addRow([]);
  const note = ws.addRow(["Late and Left early are tags only (no pay cut). Half day: punched in after, or out before, the middle of the shift. See the Attendance sheet for every day."]);
  note.font = { italic: true, size: 9, color: { argb: MUTED } };
  ws.mergeCells(note.number, 1, note.number, 5);

  // ---------- Attendance (one row per day) ----------
  const at = wb.addWorksheet("Attendance", { views: [{ state: "frozen", ySplit: 1 }] });
  at.columns = [
    { header: "Date", key: "date", width: 13 },
    { header: "Day", key: "day", width: 6 },
    { header: "Status", key: "status", width: 18 },
    { header: "Clock in", key: "in", width: 11 },
    { header: "Clock out", key: "out", width: 11 },
    { header: "Worked (h:mm)", key: "worked", width: 14 },
    { header: "Late (min)", key: "late", width: 11 },
    { header: "Left early (min)", key: "early", width: 15 },
    { header: "Day counted", key: "factor", width: 12 },
    { header: "Pay (₹)", key: "pay", width: 13 },
    { header: "Note", key: "note", width: 22 },
  ];
  const hr = at.getRow(1);
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } }));
  s.days.forEach((d, i) => {
    const r = at.addRow({
      date: new Date(`${d.date}T00:00:00Z`),
      day: d.weekday,
      status: d.status,
      in: d.inTime ?? "",
      out: d.outTime ?? "",
      worked: mins(d.workedMins),
      late: d.lateMins || null,
      early: d.earlyMins || null,
      factor: d.factor,
      pay: rupees(d.pay),
      note: [d.manual ? "Marked by hand" : "", d.missingOut ? "No out punch" : ""].filter(Boolean).join(", "),
    });
    r.getCell("date").numFmt = "dd mmm yyyy";
    r.getCell("pay").numFmt = RS;
    if (d.lateMins) r.getCell("late").font = r.getCell("in").font = { color: { argb: RED }, bold: true };
    if (d.earlyMins) r.getCell("early").font = r.getCell("out").font = { color: { argb: RED }, bold: true };
    if (d.status === "Absent" || d.status === "Unpaid leave") r.getCell("status").font = { color: { argb: RED } };
    if (i % 2 === 1) r.eachCell({ includeEmpty: true }, (cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } }));
  });
  const first = 2;
  const last = s.days.length + 1;
  const tr = at.addRow({ date: "Total", factor: { formula: `SUM(I${first}:I${last})`, result: c.payableDays }, pay: { formula: `SUM(J${first}:J${last})`, result: rupees(s.days.reduce((a, d) => a + d.pay, 0)) }, late: { formula: `SUM(G${first}:G${last})`, result: c.lateMins }, early: { formula: `SUM(H${first}:H${last})`, result: c.earlyMins } });
  tr.font = { bold: true };
  tr.getCell("pay").numFmt = RS;
  tr.getCell("date").border = { top: { style: "thin" } };
  at.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 11 } };

  // ---------- Entries ----------
  const en = wb.addWorksheet("Entries");
  en.columns = [
    { header: "Date", key: "date", width: 13 },
    { header: "Type", key: "kind", width: 12 },
    { header: "Amount (₹)", key: "amount", width: 14 },
    { header: "Note", key: "note", width: 40 },
  ];
  en.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  en.getRow(1).eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } }));
  for (const x of s.entries) {
    const r = en.addRow({ date: new Date(`${x.date}T00:00:00Z`), kind: x.kind, amount: rupees(x.amount), note: x.note });
    r.getCell("date").numFmt = "dd mmm yyyy";
    r.getCell("amount").numFmt = RS;
  }
  if (!s.entries.length) en.addRow({ note: "No advances, payments or adjustments in this period." });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
