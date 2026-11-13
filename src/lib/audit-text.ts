import "server-only";
import type { AuditLog } from "@prisma/client";
import { STATUS_LABEL } from "./attendance";
import { db } from "./db";
import { formatRs } from "./money";
import { ALL_PERMISSIONS } from "./permissions";
import { dbToDateKey, formatDateKey, formatMonth } from "./time";

// Turns raw history rows (action codes, ids, JSON) into plain sentences with names.

export type HistoryArea = "employee" | "attendance" | "advance" | "salary" | "settings" | "team" | "device";

export interface HistoryItem {
  id: string;
  at: string; // ISO time
  by: string;
  area: HistoryArea;
  title: string;
  detail: string | null;
}

const PERM_SHORT: Record<string, string> = {
  "employees.manage": "employees",
  "salary.edit": "wages",
  "attendance.edit": "attendance",
  "advances.manage": "advances",
  "approvals.decide": "approvals",
  "payroll.run": "prepare salary",
  "payroll.lock": "lock salary and payments",
  "devices.register": "scanners",
  "settings.manage": "settings",
};

type Detail = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}/.test(s(v)) ? formatDateKey(s(v).slice(0, 10)) : s(v));
const month = (v: unknown) => (/^\d{4}-\d{2}$/.test(s(v)) ? formatMonth(s(v)) : s(v));
const plan = (months: unknown, start: unknown) => (n(months) <= 1 ? `recover in full from ${month(start)}` : `recover over ${n(months)} months from ${month(start)}`);
const join = (...parts: (string | null | undefined | false)[]) => {
  const text = parts.filter(Boolean).join(" · ");
  return text ? text[0].toUpperCase() + text.slice(1) : null;
};

function perms(list: unknown): string {
  const p = Array.isArray(list) ? list.map(String) : [];
  if (p.length >= ALL_PERMISSIONS.length) return "full access";
  if (p.length === 0) return "view only";
  return p.map((x) => PERM_SHORT[x] ?? x).join(", ");
}

export async function describeHistory(businessId: string, logs: AuditLog[]): Promise<HistoryItem[]> {
  const ids = (pick: (l: AuditLog, d: Detail) => unknown) =>
    [...new Set(logs.map((l) => pick(l, (l.detail ?? {}) as Detail)).filter((x): x is string => typeof x === "string" && !!x))];

  const advanceIds = ids((l) => (l.entity === "Advance" ? l.entityId : null));
  const punchIds = ids((l) => (l.entity === "AttendancePunch" ? l.entityId : null));
  const lineIds = ids((l) => (l.entity === "PayrollLine" ? l.entityId : null));
  const approvalIds = ids((l) => (l.entity === "ApprovalRequest" ? l.entityId : null));

  const [advances, punches, lines, approvals] = await Promise.all([
    db.advance.findMany({ where: { id: { in: advanceIds }, businessId }, select: { id: true, employeeId: true, amount: true } }),
    db.attendancePunch.findMany({ where: { id: { in: punchIds } }, select: { id: true, employeeId: true, type: true, workDate: true } }),
    db.payrollLine.findMany({ where: { id: { in: lineIds } }, select: { id: true, employeeId: true, run: { select: { month: true } } } }),
    db.approvalRequest.findMany({ where: { id: { in: approvalIds }, businessId }, select: { id: true, summary: true } }),
  ]);
  const advanceById = new Map(advances.map((a) => [a.id, a]));
  const punchById = new Map(punches.map((p) => [p.id, p]));
  const lineById = new Map(lines.map((x) => [x.id, x]));
  const approvalById = new Map(approvals.map((a) => [a.id, a.summary]));

  const employeeIds = [
    ...ids((l, d) => (l.entity === "Employee" ? l.entityId : d.employeeId)),
    ...advances.map((a) => a.employeeId),
    ...punches.map((p) => p.employeeId),
    ...lines.map((x) => x.employeeId),
  ];
  const userIds = [...ids((l) => l.actorId), ...ids((l) => (l.entity === "User" ? l.entityId : null))];
  const [employees, users, sites, devices] = await Promise.all([
    db.employee.findMany({ where: { id: { in: [...new Set(employeeIds)] }, businessId }, select: { id: true, name: true, code: true } }),
    db.user.findMany({ where: { id: { in: userIds }, businessId }, select: { id: true, name: true } }),
    db.site.findMany({ where: { businessId }, select: { id: true, name: true } }),
    db.device.findMany({ where: { id: { in: ids((l) => (l.entity === "Device" ? l.entityId : null)) }, businessId }, select: { id: true, name: true } }),
  ]);
  const emp = new Map(employees.map((e) => [e.id, `${e.name} (${e.code})`]));
  const user = new Map(users.map((u) => [u.id, u.name]));
  const site = new Map(sites.map((x) => [x.id, x.name]));
  const device = new Map(devices.map((x) => [x.id, x.name]));
  const empName = (id: unknown) => emp.get(s(id)) ?? "an employee";
  const siteNames = (list: unknown) => {
    const arr = Array.isArray(list) ? list.map(String) : [];
    return arr.length ? arr.map((x) => site.get(x) ?? "?").join(", ") : "all sites";
  };

  return logs.map((l) => {
    const d = (l.detail ?? {}) as Detail;
    const base = { id: l.id, at: l.createdAt.toISOString(), by: l.actorId ? user.get(l.actorId) ?? "Removed user" : "System" };
    const r = (area: HistoryArea, title: string, detail: string | null = null): HistoryItem => ({ ...base, area, title, detail });
    const subject = l.entity === "Employee" ? empName(l.entityId) : empName(d.employeeId);

    switch (l.action) {
      case "employee.create":
        return r("employee", `Added employee ${s(d.name)} (${s(d.code)})`);
      case "employee.update":
        return r("employee", `Edited details of ${subject}`);
      case "employee.left":
        return r("employee", `Marked ${subject} as left`, `Last day ${date(d.leftOn)}. Face removed.`);
      case "employee.rejoin":
        return r("employee", `Made ${subject} active again`);
      case "employee.login.on":
        return r("employee", `Turned on web login for ${subject}`);
      case "employee.login.off":
        return r("employee", `Turned off web login for ${subject}`);
      case "face.enroll":
        return r("employee", `Enrolled face of ${subject}`, d.photos ? `${n(d.photos)} photo${n(d.photos) === 1 ? "" : "s"}` : null);
      case "face.remove":
        return r("employee", `Removed face of ${subject}`);

      case "attendance.override":
        return r("attendance", `Marked ${subject} as ${STATUS_LABEL[s(d.status) as keyof typeof STATUS_LABEL] ?? s(d.status)} on ${date(d.date)}`, d.reason ? `Reason: ${s(d.reason)}` : null);
      case "attendance.override.clear":
        return r("attendance", `Removed the manual status of ${subject} on ${date(d.date)}`);
      case "attendance.punch.add":
        return r("attendance", `Added a missed ${s(d.type)} punch at ${s(d.time)} for ${subject} on ${date(d.date)}`, d.reason ? `Reason: ${s(d.reason)}` : null);
      case "attendance.punch.void": {
        const p = punchById.get(s(l.entityId));
        return r("attendance", `Removed ${p ? `the ${p.type} punch of ${empName(p.employeeId)} on ${formatDateKey(dbToDateKey(p.workDate))}` : "a punch"}`, d.reason ? `Reason: ${s(d.reason)}` : null);
      }

      case "advance.create":
        return r("advance", `Gave an advance of ${formatRs(n(d.amount))} to ${subject}`, join(plan(d.recoveryMonths, d.startMonth), d.goesNegative ? "balance went negative" : null));
      case "advance.edit": {
        const a = advanceById.get(s(l.entityId));
        const b = (d.before ?? {}) as Detail;
        const af = (d.after ?? {}) as Detail;
        return r(
          "advance",
          `Changed the advance of ${a ? empName(a.employeeId) : "an employee"}`,
          join(
            n(b.amount) !== n(af.amount) && `amount ${formatRs(n(b.amount))} → ${formatRs(n(af.amount))}`,
            s(b.givenOn) !== s(af.givenOn) && `date ${date(b.givenOn)} → ${date(af.givenOn)}`,
            n(b.recoveryMonths) !== n(af.recoveryMonths) && `months ${n(b.recoveryMonths)} → ${n(af.recoveryMonths)}`,
            s(b.startMonth) !== s(af.startMonth) && `start ${month(b.startMonth)} → ${month(af.startMonth)}`,
          ) ?? "note changed",
        );
      }
      case "advance.cancel":
        return r("advance", `Cancelled an advance of ${formatRs(n(d.amount))} to ${subject}`);
      case "approval.approve":
        return r("advance", "Approved an advance", approvalById.get(s(l.entityId)) ?? null);
      case "approval.reject":
        return r("advance", "Rejected an advance", approvalById.get(s(l.entityId)) ?? null);
      case "approval.otp":
        return r("advance", "Approved an advance with the owner's OTP", approvalById.get(s(l.entityId)) ?? null);

      case "payroll.recalculate":
        return r("salary", `Calculated salary for ${month(d.month)}`);
      case "payroll.lock":
        return r("salary", `Approved and locked salary for ${month(d.month)}`);
      case "payroll.reopen":
        return r("salary", `Reopened salary for ${month(d.month)}`);
      case "payroll.adjustment": {
        const amt = n(d.amount);
        return r("salary", `${amt >= 0 ? "Extra payment" : "Deduction"} of ${formatRs(Math.abs(amt))} for ${subject} in ${month(d.month)}`, d.reason ? `Reason: ${s(d.reason)}` : null);
      }
      case "payroll.payment": {
        const line = lineById.get(s(l.entityId));
        return r(
          "salary",
          `Recorded salary payment of ${formatRs(n(d.after))} to ${line ? empName(line.employeeId) : "an employee"}${line ? ` for ${formatMonth(line.run.month)}` : ""}`,
          join(s(d.mode), n(d.before) ? `was ${formatRs(n(d.before))}` : null),
        );
      }

      case "settings.update":
        return r("settings", "Changed business settings", "Name, scan rules, weekly schedule or PF / ESIC rates");
      case "site.create":
        return r("settings", `Added site ${s(d.name)}`);
      case "site.disable":
        return r("settings", `Turned off site ${site.get(s(l.entityId)) ?? ""}`.trim());
      case "site.enable":
        return r("settings", `Turned on site ${site.get(s(l.entityId)) ?? ""}`.trim());
      case "holiday.add":
        return r("settings", `Added holiday ${s(d.name)} on ${date(d.date)}`);
      case "holiday.remove":
        return r("settings", `Removed holiday ${s(d.name)} on ${date(d.date)}`);

      case "manager.create":
        return r("team", `Added manager ${s(d.name)}`, join(`Sites: ${siteNames(d.siteIds)}`, `Can do: ${perms(d.permissions)}`));
      case "manager.update":
        return r("team", `Changed what ${user.get(s(l.entityId)) ?? "a manager"} can do`, join(`Sites: ${siteNames(d.siteIds)}`, `Can do: ${perms(d.permissions)}`));
      case "manager.disable":
        return r("team", `Turned off login of ${user.get(s(l.entityId)) ?? "a manager"}`);
      case "manager.enable":
        return r("team", `Turned on login of ${user.get(s(l.entityId)) ?? "a manager"}`);

      case "device.register":
        return r("device", `Made "${s(d.name)}" a face scanner`, join(`Site: ${site.get(s(d.siteId)) ?? "?"}`, d.via === "app" ? "from the app" : "from the website"));
      case "device.reregister":
        return r("device", `Set up scanner "${s(d.name)}" again on the same device`, `Site: ${site.get(s(d.siteId)) ?? "?"}`);
      case "device.rename":
        return r("device", `Renamed scanner "${s(d.from)}" to "${s(d.to)}"`, `Site: ${site.get(s(d.siteId)) ?? "?"}`);
      case "device.revoke":
        return r("device", `Removed scanner "${device.get(s(l.entityId)) ?? "?"}"`);

      default:
        return r("settings", l.action.replace(/[._]/g, " "));
    }
  });
}
