import { describe, expect, it } from "vitest";
import { countDays, deriveMonth, nextPunch, type PunchInput } from "./attendance";
import { parseRs, formatRs } from "./money";
import { advanceDue, calculatePay, grossPay, statutory, type StatutoryRates } from "./payroll";
import { istDateKey, istDateTime, monthDiff, addMonths, daysInMonth } from "./time";

const rates: StatutoryRates = {
  pfEmployeeBps: 1200,
  pfEmployerBps: 1200,
  pfWageCeiling: 1500000,
  esiEmployeeBps: 75,
  esiEmployerBps: 325,
};

const noRules = { weeklyOffDays: [0], holidays: new Set<string>(), halfDayBelowMins: 240 };

function punch(type: "IN" | "OUT", date: string, hhmm: string, workDate = date): PunchInput {
  return { type, at: istDateTime(date, hhmm), workDate };
}

describe("time", () => {
  it("uses IST dates", () => {
    expect(istDateKey(new Date("2026-11-11T19:00:00Z"))).toBe("2026-11-12"); // 00:30 IST
    expect(istDateKey(new Date("2026-11-11T18:00:00Z"))).toBe("2026-11-11"); // 23:30 IST
  });
  it("does month maths", () => {
    expect(monthDiff("2026-11", "2027-02")).toBe(3);
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("money", () => {
  it("parses rupees", () => {
    expect(parseRs("1,500")).toBe(150000);
    expect(parseRs("10.5")).toBe(1050);
    expect(parseRs("abc")).toBeNull();
    expect(parseRs("-5")).toBeNull();
    expect(formatRs(12345678)).toBe("₹1,23,456.78");
  });
});

describe("attendance", () => {
  const ctx = { today: "2026-11-30", joinedOn: "2026-01-01", leftOn: null };

  it("marks present, half day, absent and weekly off", () => {
    const punches = [
      punch("IN", "2026-11-02", "09:00"),
      punch("OUT", "2026-11-02", "18:00"),
      punch("IN", "2026-11-03", "09:00"),
      punch("OUT", "2026-11-03", "11:00"),
    ];
    const days = deriveMonth("2026-11", punches, [], noRules, ctx);
    expect(days[1].status).toBe("PRESENT"); // 2 Nov
    expect(days[1].workedMins).toBe(540);
    expect(days[2].status).toBe("HALF_DAY"); // 3 Nov, 2 hours
    expect(days[0].status).toBe("WEEKLY_OFF"); // 1 Nov 2026 is a Sunday
    expect(days[3].status).toBe("ABSENT");
  });

  it("marks in-house staff present on working days without scans; short scan is still a full day", () => {
    const inHouse = { ...ctx, inHouse: true, today: "2026-11-10" };
    const days = deriveMonth(
      "2026-11",
      [punch("IN", "2026-11-03", "09:00"), punch("OUT", "2026-11-03", "10:00")],
      [{ workDate: "2026-11-05", status: "UNPAID_LEAVE", createdAt: new Date("2026-11-05T10:00:00Z") }],
      noRules,
      inHouse,
    );
    expect(days[1].status).toBe("PRESENT"); // 2 Nov, no scan
    expect(days[1].auto).toBe(true);
    expect(days[2].status).toBe("PRESENT"); // 3 Nov, scanned 1 hour: still full day
    expect(days[0].status).toBe("WEEKLY_OFF"); // Sunday stays off
    expect(days[4].status).toBe("UNPAID_LEAVE"); // manual leave wins
    expect(days[10].status).toBe("FUTURE"); // 11 Nov is after "today"
  });

  it("scheduled leave marks working days; a scan or a manual status wins; offs stay off", () => {
    const leaves = new Map<string, "PAID_LEAVE" | "UNPAID_LEAVE">();
    for (let d = 1; d <= 10; d++) leaves.set(`2026-11-${String(d).padStart(2, "0")}`, "PAID_LEAVE");
    const days = deriveMonth(
      "2026-11",
      [punch("IN", "2026-11-05", "09:00"), punch("OUT", "2026-11-05", "18:00")],
      [{ workDate: "2026-11-06", status: "ABSENT", createdAt: new Date("2026-11-06T10:00:00Z") }],
      noRules,
      { ...ctx, today: "2026-11-03" },
      leaves,
    );
    expect(days[0].status).toBe("WEEKLY_OFF"); // Sunday 1 Nov inside the leave stays off
    expect(days[1].status).toBe("PAID_LEAVE"); // 2 Nov
    expect(days[4].status).toBe("PRESENT"); // 5 Nov: came back and scanned
    expect(days[5].status).toBe("ABSENT"); // 6 Nov: manager set absent
    expect(days[8].status).toBe("PAID_LEAVE"); // 9 Nov is in the future but planned leave shows
    expect(days[11].status).toBe("FUTURE"); // 12 Nov: after the leave
  });

  it("counts a missing OUT as present but flags it", () => {
    const days = deriveMonth("2026-11", [punch("IN", "2026-11-04", "09:00")], [], noRules, ctx);
    expect(days[3].status).toBe("PRESENT");
    expect(days[3].missingOut).toBe(true);
    expect(countDays(days).missingOut).toBe(1);
  });

  it("uses the newest manual override", () => {
    const days = deriveMonth(
      "2026-11",
      [],
      [
        { workDate: "2026-11-05", status: "PAID_LEAVE", createdAt: new Date("2026-11-06T10:00:00Z") },
        { workDate: "2026-11-05", status: "PRESENT", createdAt: new Date("2026-11-06T11:00:00Z") },
      ],
      noRules,
      ctx,
    );
    expect(days[4].status).toBe("PRESENT");
    expect(days[4].overridden).toBe(true);
  });

  it("ignores days before joining and future days", () => {
    const days = deriveMonth("2026-11", [], [], noRules, { today: "2026-11-10", joinedOn: "2026-11-05", leftOn: null });
    expect(days[2].status).toBe("NOT_EMPLOYED");
    expect(days[20].status).toBe("FUTURE");
    expect(countDays(days).employedDays).toBe(26);
  });

  it("closes a night shift across midnight", () => {
    const last = { type: "IN" as const, at: istDateTime("2026-11-10", "22:00"), workDate: "2026-11-10" };
    const r = nextPunch(last, istDateTime("2026-11-11", "06:00"), "2026-11-11", { duplicateScanMins: 2, maxShiftHours: 16 });
    expect(r).toEqual({ action: "punch", type: "OUT", workDate: "2026-11-10" });
  });

  it("ignores a double scan and opens a new IN after a long gap", () => {
    const last = { type: "IN" as const, at: istDateTime("2026-11-10", "09:00"), workDate: "2026-11-10" };
    expect(nextPunch(last, istDateTime("2026-11-10", "09:01"), "2026-11-10", { duplicateScanMins: 2, maxShiftHours: 16 })).toEqual({
      action: "duplicate",
    });
    expect(
      nextPunch(last, istDateTime("2026-11-11", "09:00"), "2026-11-11", { duplicateScanMins: 2, maxShiftHours: 16 }),
    ).toEqual({ action: "punch", type: "IN", workDate: "2026-11-11" });
  });
});

describe("payroll", () => {
  const counts = { present: 24, paidLeave: 0, paidOff: 4, absent: 2, unpaidLeave: 0, missingOut: 0, employedDays: 30 };
  const monthly = { wageType: "MONTHLY" as const, monthlyWage: 1500000, dailyWage: 0, basicPercent: 100, pfEnabled: false, esiEnabled: false };

  it("pays monthly staff for weekly offs", () => {
    const r = calculatePay({ month: "2026-11", daysInMonth: 30, counts, employee: monthly, rates, adjustments: 0, advances: [] });
    expect(r.payableDays).toBe(28);
    expect(r.gross).toBe(1400000); // 15000 * 28 / 30
    expect(r.net).toBe(1400000);
  });

  it("pays daily staff only for worked days", () => {
    const r = calculatePay({
      month: "2026-11",
      daysInMonth: 30,
      counts,
      employee: { ...monthly, wageType: "DAILY", dailyWage: 60000 },
      rates,
      adjustments: 0,
      advances: [],
    });
    expect(r.payableDays).toBe(24);
    expect(r.gross).toBe(1440000);
  });

  it("calculates PF with ceiling and ESIC rounded up", () => {
    const s = statutory({ ...monthly, pfEnabled: true, esiEnabled: true }, 2000000, rates);
    expect(s.pfEmployee).toBe(180000); // 12% of 15,000 ceiling
    expect(s.pfEmployer).toBe(180000);
    expect(s.esiEmployee).toBe(15000); // 0.75% of 20,000
    expect(s.esiEmployer).toBe(65000);
    const odd = statutory({ ...monthly, esiEnabled: true }, 1234567, rates);
    expect(odd.esiEmployee).toBe(9300); // 92.59 -> 93
  });

  it("does nothing for PF/ESIC when switched off", () => {
    expect(statutory(monthly, 2000000, rates)).toEqual({ pfEmployee: 0, pfEmployer: 0, esiEmployee: 0, esiEmployer: 0 });
  });

  it("spreads an advance over instalments", () => {
    const a = { id: "a", amount: 1000000, recoveryMonths: 4, startMonth: "2026-11", recoveredBefore: 0, givenOn: "2026-11-05" };
    expect(advanceDue(a, "2026-11")).toBe(250000);
    expect(advanceDue({ ...a, recoveredBefore: 250000 }, "2026-12")).toBe(250000);
    // Last month takes everything left even if earlier months recovered less.
    expect(advanceDue({ ...a, recoveredBefore: 500000 }, "2027-02")).toBe(500000);
    expect(advanceDue(a, "2026-10")).toBe(0);
  });

  it("rolls an advance forward when salary is not enough", () => {
    const r = calculatePay({
      month: "2026-11",
      daysInMonth: 30,
      counts,
      employee: monthly,
      rates,
      adjustments: 0,
      advances: [{ id: "a", amount: 2000000, recoveryMonths: 1, startMonth: "2026-11", recoveredBefore: 0, givenOn: "2026-11-01" }],
    });
    expect(r.advanceRecovered).toBe(1400000);
    expect(r.net).toBe(0);
  });

  it("applies adjustments before deductions", () => {
    const r = calculatePay({ month: "2026-11", daysInMonth: 30, counts, employee: monthly, rates, adjustments: -50000, advances: [] });
    expect(r.net).toBe(1350000);
  });
});

describe("override AUTO", () => {
  it("returns to automatic status when the newest override is AUTO", () => {
    const days = deriveMonth(
      "2026-11",
      [],
      [
        { workDate: "2026-11-05", status: "PAID_LEAVE", createdAt: new Date("2026-11-06T10:00:00Z") },
        { workDate: "2026-11-05", status: "AUTO", createdAt: new Date("2026-11-06T11:00:00Z") },
      ],
      noRules,
      { today: "2026-11-30", joinedOn: "2026-01-01", leftOn: null },
    );
    expect(days[4].status).toBe("ABSENT");
    expect(days[4].overridden).toBe(false);
  });
});

describe("per-weekday rules", () => {
  const byWeekday = Array.from({ length: 7 }, (_, i) =>
    i === 0 ? { halfDayBelowMins: 0, anyScanFullDay: true } : { halfDayBelowMins: 240, anyScanFullDay: false },
  );
  const rules = { weeklyOffDays: [], holidays: new Set<string>(), halfDayBelowMins: 240, byWeekday };
  const ctx = { today: "2026-11-30", joinedOn: "2026-01-01", leftOn: null };

  it("counts a short Sunday shift as a full day", () => {
    // 8 Nov 2026 is a Sunday: 11:00 to 13:00 is only 2 hours.
    const days = deriveMonth("2026-11", [punch("IN", "2026-11-08", "11:00"), punch("OUT", "2026-11-08", "13:00")], [], rules, ctx);
    expect(days[7].status).toBe("PRESENT");
  });

  it("still applies the half-day rule on other days", () => {
    const days = deriveMonth("2026-11", [punch("IN", "2026-11-09", "11:00"), punch("OUT", "2026-11-09", "13:00")], [], rules, ctx);
    expect(days[8].status).toBe("HALF_DAY");
  });

  it("treats a Sunday without scans as absent when Sunday is a working day", () => {
    const days = deriveMonth("2026-11", [], [], rules, ctx);
    expect(days[7].status).toBe("ABSENT");
  });
});

describe("day rules parsing", () => {
  it("falls back to defaults for bad data", async () => {
    const { parseDayRules, effectiveWeeklyOff } = await import("./day-rules");
    const r = parseDayRules([{ open: "25:00", close: "15:00", halfDayBelowMins: -5, anyScanFullDay: "yes" }]);
    expect(r[0]).toEqual({ open: "09:00", close: "15:00", halfDayBelowMins: 0, anyScanFullDay: true });
    expect(r).toHaveLength(7);
    expect(parseDayRules(null)[1].halfDayBelowMins).toBe(240);
    expect(effectiveWeeklyOff({ weeklyOffDays: [0] }, { customWeeklyOff: true, weeklyOffDays: [2] })).toEqual([2]);
    expect(effectiveWeeklyOff({ weeklyOffDays: [0] }, { customWeeklyOff: false, weeklyOffDays: [2] })).toEqual([0]);
  });
});

describe("month length", () => {
  const emp = { wageType: "MONTHLY" as const, monthlyWage: 3000000, dailyWage: 0, basicPercent: 100, pfEnabled: false, esiEnabled: false };
  it("pays the full salary for a full month of 28, 30 or 31 days", () => {
    expect(grossPay(emp, 28, 28)).toBe(3000000); // February
    expect(grossPay(emp, 30, 30)).toBe(3000000);
    expect(grossPay(emp, 31, 31)).toBe(3000000);
  });
  it("uses that month's own day count for missed days", () => {
    expect(grossPay(emp, 27, 28)).toBe(Math.round((3000000 * 27) / 28)); // one day missed in February
    expect(grossPay(emp, 30, 31)).toBe(Math.round((3000000 * 30) / 31));
  });
});
