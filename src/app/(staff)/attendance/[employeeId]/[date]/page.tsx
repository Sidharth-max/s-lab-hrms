import { BackLink } from "@/components/BackLink";
import { PageHero, SectionTitle } from "@/components/PageHero";
import { CalendarCheck, Clock, History, Pencil } from "@/components/icons";
import { notFound } from "next/navigation";
import { clearDayStatusAndReturn, markAttendanceAndReturn, setDayStatusAndReturn, voidPunch } from "@/app/actions/attendance";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { earlyLabel, lateLabel, STATUS_LABEL } from "@/lib/attendance";
import { db } from "@/lib/db";
import { can, canSeeSite } from "@/lib/permissions";
import { monthAttendance, rulesForEmployee } from "@/lib/services";
import { dateKeyToDb, formatDateKey, formatIstTime, istDateKey, weekday } from "@/lib/time";
import { Select, TimeInput } from "@/components/controls";

export default async function DayDetail({ params }: PageProps<"/attendance/[employeeId]/[date]">) {
  const actor = await requireStaff();
  const { employeeId, date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const emp = await db.employee.findFirst({ where: { id: employeeId, businessId: actor.businessId } });
  if (!emp || !canSeeSite(actor, emp.siteId)) notFound();

  const [punches, overrides, { days, business }] = await Promise.all([
    db.attendancePunch.findMany({ where: { employeeId, workDate: dateKeyToDb(date) }, orderBy: { at: "asc" } }),
    db.dayOverride.findMany({ where: { employeeId, workDate: dateKeyToDb(date) }, orderBy: { createdAt: "desc" } }),
    monthAttendance(actor.businessId, date.slice(0, 7), [emp]),
  ]);
  const userIds = [...new Set([...punches.map((p) => p.createdBy), ...punches.map((p) => p.voidedBy), ...overrides.map((o) => o.createdBy)].filter(Boolean) as string[])];
  const users = new Map((await db.user.findMany({ where: { id: { in: userIds } } })).map((u) => [u.id, u.name]));
  const day = days.get(emp.id)!.find((d) => d.date === date)!;
  // Any past date can be corrected; the salary balance follows by itself.
  const editable = can(actor, "attendance.edit") && date <= istDateKey(new Date());
  const hours = (await rulesForEmployee(business, emp.id))[weekday(date)]; // default "full day" for marking by hand
  const statuses = [
    ["PRESENT", "Present"],
    ["HALF_DAY", "Half day"],
    ["ABSENT", "Absent"],
    ["PAID_LEAVE", "Paid leave"],
    ["UNPAID_LEAVE", "Unpaid leave"],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <BackLink href={`/attendance?date=${date}`} label="Attendance" />
      </div>
      <PageHero
        avatar={emp.name}
        eyebrow={formatDateKey(date)}
        title={emp.name}
        pills={[
          { label: STATUS_LABEL[day.status] ?? "—", tone: day.status === "PRESENT" ? "ok" : day.status === "ABSENT" || day.status === "HALF_DAY" || day.status === "UNPAID_LEAVE" ? "alert" : undefined },
          ...(day.late ? [{ label: lateLabel(day.lateMins).replace(/^late/, "Late"), tone: "alert" as const }] : []),
          ...(day.early ? [{ label: earlyLabel(day.earlyMins).replace(/^left/, "Left"), tone: "alert" as const }] : []),
          ...(day.overridden ? [{ label: "Edited by hand" }] : []),
        ]}
        stats={[
          { label: "In", value: punches.find((p) => p.type === "IN" && !p.voidedAt) ? formatIstTime(punches.find((p) => p.type === "IN" && !p.voidedAt)!.at) : "—" },
          { label: "Out", value: [...punches].reverse().find((p) => p.type === "OUT" && !p.voidedAt) ? formatIstTime([...punches].reverse().find((p) => p.type === "OUT" && !p.voidedAt)!.at) : "—" },
          { label: "Punches", value: punches.filter((p) => !p.voidedAt).length },
        ]}
      />
      {!can(actor, "attendance.edit") && <div className="card muted text-sm">You can view but not edit attendance.</div>}

      <section className="card">
        <SectionTitle icon={<Clock size={18} />} ink="teal">Punches</SectionTitle>
        <table className="table table-cards">
          <thead><tr><th>Type</th><th>Time</th><th>How</th><th /></tr></thead>
          <tbody>
            {/* Removed punches are not shown (they stay in History); only the ones that count. */}
            {punches.filter((p) => !p.voidedAt).map((p) => (
              <tr key={p.id}>
                <td className="card-title font-semibold">{p.type === "IN" ? "IN" : "OUT"}</td>
                <td data-label={"Time"}>{formatIstTime(p.at)}{istDateKey(p.at) !== date ? ` (${formatDateKey(istDateKey(p.at))})` : ""}</td>
                <td data-label={"How"}>
                  <span>
                    {p.source === "FACE"
                      ? `${"Face scan"}${p.score ? ` (${p.score.toFixed(1)}%)` : ""}`
                      : `${"Manual by"} ${users.get(p.createdBy ?? "") ?? "?"}: ${p.reason}`}
                  </span>
                </td>
                <td>
                  {editable && !p.voidedAt && (
                    <ActionForm action={voidPunch} submitLabel={"Remove"} submitClass="btn-secondary !py-1" confirm={"Remove this punch? It stays in history."}>
                      <input type="hidden" name="punchId" value={p.id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
            {punches.every((p) => p.voidedAt) && <tr><td colSpan={4} className="muted">No punches.</td></tr>}
          </tbody>
        </table>
      </section>

      {editable && (
        <div className="grid gap-4 @2xl:grid-cols-2">
          <section className="card">
            <SectionTitle icon={<Pencil size={18} />} ink="violet">Mark attendance</SectionTitle>
            <p className="muted mb-3">Full day is filled in ({hours.open} to {hours.close}). Change a time, or tick “no in / out time” for a missed punch.</p>
            <ActionForm action={markAttendanceAndReturn} className="flex flex-col gap-3" submitLabel="Save attendance">
              <input type="hidden" name="employeeId" value={emp.id} />
              <input type="hidden" name="date" value={date} />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="label !mb-0">In time</span>
                  <TimeInput name="inTime" defaultValue={hours.open} />
                  <label className="flex items-center gap-2 text-sm text-[var(--muted)]"><input type="checkbox" name="skipIn" /> No in time</label>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="label !mb-0">Out time</span>
                  <TimeInput name="outTime" defaultValue={hours.close} />
                  <label className="flex items-center gap-2 text-sm text-[var(--muted)]"><input type="checkbox" name="skipOut" /> No out time</label>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="nextDay" /> {"Out time is after midnight (night shift)"}</label>
              <input name="reason" className="input" placeholder={"Reason (optional), e.g. forgot to scan…"} />
            </ActionForm>
          </section>
          <section className="card">
            <SectionTitle icon={<CalendarCheck size={18} />} ink="blue">Set day status</SectionTitle>
            <p className="muted mb-3">For leave, absent or half day. This overrides scans and scheduled leave for this day. To record working times, use Mark attendance.</p>
            <ActionForm action={setDayStatusAndReturn} className="flex flex-col gap-3" submitLabel={"Set status"} resetOnSuccess>
              <input type="hidden" name="employeeId" value={emp.id} />
              <input type="hidden" name="date" value={date} />
              <Select name="status" defaultValue="PRESENT" options={statuses.map(([v, l]) => ({ value: v, label: l }))} ariaLabel="Day status" />
              <input name="reason" className="input" placeholder={"Reason"} required />
            </ActionForm>
            {day.overridden && (
              <div className="mt-3">
                <ActionForm action={clearDayStatusAndReturn} submitLabel={"Back to automatic (from scans)"} submitClass="btn-secondary">
                  <input type="hidden" name="employeeId" value={emp.id} />
                  <input type="hidden" name="date" value={date} />
                </ActionForm>
              </div>
            )}
          </section>
        </div>
      )}

      {overrides.length > 0 && (
        <section className="card">
          <SectionTitle icon={<History size={18} />} ink="violet">Edit history</SectionTitle>
          <ul className="flex flex-col gap-1 text-sm">
            {overrides.map((o) => (
              <li key={o.id}>
                {o.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}: {users.get(o.createdBy) ?? "?"} set{" "}
                <b>{o.status === "AUTO" ? "automatic" : STATUS_LABEL[o.status]}</b> — {o.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
