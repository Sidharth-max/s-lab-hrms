import "server-only";
import { STATUS_LABEL } from "./attendance";
import { db } from "./db";
import { parseDayRules } from "./day-rules";
import { env } from "./env";
import { hisaabFor } from "./ledger";
import { can, type Actor } from "./permissions";
import { employeeScope } from "./scope";
import { monthAttendance } from "./services";
import { formatIstTime, istDateKey, weekday } from "./time";

/**
 * The Today dashboard as ONE data model, used by the website (/dashboard) and the app
 * (/api/m/dashboard). Before, each built its own numbers, so they drifted apart (the web showed
 * site and in / out details that the app did not). Both now render exactly these fields.
 */
export interface DashboardRow {
  id: string;
  name: string;
  code: string;
  site: string;
  siteId: string;
  status: string;
  /** "Not in yet" instead of "Absent" on the Today screen. */
  statusLabel: string;
  inAt: string | null;
  outAt: string | null;
  inside: boolean;
  manual: boolean;
  needsFace: boolean;
  late: boolean;
  lateMins: number;
}

export interface DashboardSite {
  id: string;
  name: string;
  total: number;
  present: number;
  inside: number;
  notIn: number;
}

export interface Dashboard {
  date: string;
  greeting: string;
  storeHours: { open: string; close: string; anyScanFullDay: boolean } | null;
  counts: { total: number; present: number; inside: number; notIn: number; pendingApprovals: number };
  sites: DashboardSite[];
  /** Check-ins per hour today (for the arrivals chart), hours 6..22. */
  arrivals: { hour: number; count: number }[];
  /** Salary money, only for people allowed to see balances. */
  payroll: { toPay: number; owed: number; people: number } | null;
  rows: DashboardRow[];
  noFace: { id: string; name: string }[];
}

/** Hour of the day in India (0..23). */
function istHour(d: Date) {
  return new Date(d.getTime() + 5.5 * 3600000).getUTCHours();
}

function greetingFor(now: Date) {
  const h = istHour(now);
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export async function buildDashboard(actor: Actor): Promise<Dashboard> {
  const now = new Date();
  const today = istDateKey(now);
  const [employees, business, pending] = await Promise.all([
    db.employee.findMany({ where: employeeScope(actor, { active: true }), include: { site: true }, orderBy: { name: "asc" } }),
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
    db.approvalRequest.count({ where: { businessId: actor.businessId, status: "PENDING" } }),
  ]);
  const { days } = await monthAttendance(actor.businessId, today.slice(0, 7), employees);
  const arrivals = Array.from({ length: 17 }, (_, i) => ({ hour: i + 6, count: 0 }));
  const rows: DashboardRow[] = employees.map((e) => {
    const d = days.get(e.id)!.find((x) => x.date === today)!;
    if (d.inAt) {
      const slot = arrivals.find((a) => a.hour === istHour(d.inAt!));
      if (slot) slot.count++;
    }
    return {
      id: e.id,
      name: e.name,
      code: e.code,
      site: e.site.name,
      siteId: e.siteId,
      status: d.status,
      statusLabel: d.auto ? "Present (auto)" : d.status === "ABSENT" ? "Not in yet" : STATUS_LABEL[d.status] ?? d.status,
      inAt: d.inAt ? formatIstTime(d.inAt) : null,
      outAt: d.outAt ? formatIstTime(d.outAt) : null,
      inside: d.missingOut,
      manual: d.overridden,
      late: d.late,
      lateMins: d.lateMins,
      // In-house staff are marked present automatically, so they do not need a face.
      // Faces enrolled in test mode must be enrolled again once real AWS face recognition is on.
      needsFace: !e.inHouse && (!e.faceId || (env.faceProvider === "aws" && e.faceId.startsWith("mock-"))),
    };
  });
  const isPresent = (r: DashboardRow) => r.status === "PRESENT" || r.status === "HALF_DAY";

  const siteMap = new Map<string, DashboardSite>();
  for (const r of rows) {
    const s = siteMap.get(r.siteId) ?? { id: r.siteId, name: r.site, total: 0, present: 0, inside: 0, notIn: 0 };
    s.total++;
    if (isPresent(r)) s.present++;
    if (r.inside) s.inside++;
    if (r.status === "ABSENT") s.notIn++;
    siteMap.set(r.siteId, s);
  }

  let payroll: Dashboard["payroll"] = null;
  if (can(actor, "payroll.run")) {
    const all = await hisaabFor(actor.businessId, employees);
    let toPay = 0;
    let owed = 0;
    let people = 0;
    for (const h of all.values()) {
      if (h.balance > 0) {
        toPay += h.balance;
        people++;
      } else owed += -h.balance;
    }
    payroll = { toPay, owed, people };
  }

  const rule = parseDayRules(business.dayRules)[weekday(today)];
  return {
    date: today,
    greeting: `${greetingFor(now)}, ${actor.name.split(" ")[0]}`,
    storeHours: business.weeklyOffDays.includes(weekday(today)) ? null : { open: rule.open, close: rule.close, anyScanFullDay: rule.anyScanFullDay },
    counts: {
      total: rows.length,
      present: rows.filter(isPresent).length,
      inside: rows.filter((r) => r.inside).length,
      notIn: rows.filter((r) => r.status === "ABSENT").length,
      pendingApprovals: pending,
    },
    sites: [...siteMap.values()].sort((a, b) => b.total - a.total),
    arrivals,
    payroll,
    rows,
    noFace: rows.filter((r) => r.needsFace).map((r) => ({ id: r.id, name: r.name })),
  };
}
