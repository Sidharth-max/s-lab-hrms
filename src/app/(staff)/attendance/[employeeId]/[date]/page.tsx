import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { addManualPunch, clearDayStatus, setDayStatus, voidPunch } from "@/app/actions/attendance";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/attendance";
import { db } from "@/lib/db";
import { can, canSeeSite } from "@/lib/permissions";
import { monthAttendance } from "@/lib/services";
import { dateKeyToDb, formatDateKey, formatIstTime, istDateKey } from "@/lib/time";
import { Select, TimeInput } from "@/components/controls";

export default async function DayDetail({ params }: PageProps<"/attendance/[employeeId]/[date]">) {
  const actor = await requireStaff();
  const { employeeId, date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const emp = await db.employee.findFirst({ where: { id: employeeId, businessId: actor.businessId } });
  if (!emp || !canSeeSite(actor, emp.siteId)) notFound();

  const [punches, overrides, run, { days }] = await Promise.all([
    db.attendancePunch.findMany({ where: { employeeId, workDate: dateKeyToDb(date) }, orderBy: { at: "asc" } }),
    db.dayOverride.findMany({ where: { employeeId, workDate: dateKeyToDb(date) }, orderBy: { createdAt: "desc" } }),
    db.payrollRun.findUnique({ where: { businessId_month: { businessId: actor.businessId, month: date.slice(0, 7) } } }),
    monthAttendance(actor.businessId, date.slice(0, 7), [emp]),
  ]);
  const userIds = [...new Set([...punches.map((p) => p.createdBy), ...punches.map((p) => p.voidedBy), ...overrides.map((o) => o.createdBy)].filter(Boolean) as string[])];
  const users = new Map((await db.user.findMany({ where: { id: { in: userIds } } })).map((u) => [u.id, u.name]));
  const day = days.get(emp.id)!.find((d) => d.date === date)!;
  const locked = run?.status === "LOCKED";
  const editable = can(actor, "attendance.edit") && !locked && date <= istDateKey(new Date());
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
        <h1 className="h1">{emp.name} · {formatDateKey(date)}</h1>
        <p className="text-lg">
          {STATUS_LABEL[day.status] || "—"} {day.overridden && <span className="badge badge-neutral">manual</span>}
        </p>
      </div>
      {locked && (
        <div className="notice">
          {"Salary for this month is locked, so this day cannot be edited. Use an adjustment in next month's salary."}
        </div>
      )}
      {!can(actor, "attendance.edit") && <div className="card muted text-sm">You can view but not edit attendance.</div>}

      <section className="card">
        <h2 className="mb-2 font-semibold">Punches</h2>
        <table className="table table-cards">
          <thead><tr><th>Type</th><th>Time</th><th>How</th><th /></tr></thead>
          <tbody>
            {punches.map((p) => (
              <tr key={p.id} className={p.voidedAt ? "text-[var(--muted)] line-through" : ""}>
                <td className="card-title font-semibold">{p.type === "IN" ? "IN" : "OUT"}</td>
                <td data-label={"Time"}>{formatIstTime(p.at)}{istDateKey(p.at) !== date ? ` (${formatDateKey(istDateKey(p.at))})` : ""}</td>
                <td data-label={"How"}>
                  <span>
                    {p.source === "FACE"
                      ? `${"Face scan"}${p.score ? ` (${p.score.toFixed(1)}%)` : ""}`
                      : `${"Manual by"} ${users.get(p.createdBy ?? "") ?? "?"}: ${p.reason}`}
                    {p.voidedAt && <span className="block text-xs">{"Removed by"} {users.get(p.voidedBy ?? "") ?? "?"}: {p.voidReason}</span>}
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
            {punches.length === 0 && <tr><td colSpan={4} className="muted">No punches.</td></tr>}
          </tbody>
        </table>
      </section>

      {editable && (
        <div className="grid gap-4 @2xl:grid-cols-2">
          <section className="card">
            <h2 className="mb-3 font-semibold">Add missed punch</h2>
            <ActionForm action={addManualPunch} className="flex flex-col gap-3" submitLabel={"Add punch"} resetOnSuccess>
              <input type="hidden" name="employeeId" value={emp.id} />
              <input type="hidden" name="date" value={date} />
              <div className="flex gap-2">
                <Select name="type" className="w-28" options={[{ value: "IN", label: "IN" }, { value: "OUT", label: "OUT" }]} ariaLabel="Punch type" />
                <TimeInput name="time" className="flex-1" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="nextDay" /> {"Time is after midnight (night shift)"}</label>
              <input name="reason" className="input" placeholder={"Reason (e.g. tablet not working)"} required />
            </ActionForm>
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold">Set day status</h2>
            <ActionForm action={setDayStatus} className="flex flex-col gap-3" submitLabel={"Set status"} resetOnSuccess>
              <input type="hidden" name="employeeId" value={emp.id} />
              <input type="hidden" name="date" value={date} />
              <Select name="status" defaultValue="PRESENT" options={statuses.map(([v, l]) => ({ value: v, label: l }))} ariaLabel="Day status" />
              <input name="reason" className="input" placeholder={"Reason"} required />
            </ActionForm>
            {day.overridden && (
              <div className="mt-3">
                <ActionForm action={clearDayStatus} submitLabel={"Back to automatic (from scans)"} submitClass="btn-secondary">
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
          <h2 className="mb-2 font-semibold">Edit history</h2>
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
