import { cancelLeave, endLeave, scheduleLeave } from "@/app/actions/leaves";
import { ActionForm } from "./ActionForm";
import { PopupForm } from "./PopupForm";
import { CalendarCheck } from "./icons";
import { DateInput, Select } from "./controls";
import type { LeaveRow } from "@/lib/leaves";
import { formatDateKey, istDateKey } from "@/lib/time";

const STATE: Record<LeaveRow["state"], { label: string; cls: string }> = {
  upcoming: { label: "Upcoming", cls: "badge-neutral" },
  on_leave: { label: "On leave", cls: "badge-amber" },
  done: { label: "Finished", cls: "badge-green" },
  cancelled: { label: "Cancelled", cls: "badge-neutral" },
};

/** Schedule leave and list leaves (one employee, or everyone with an employee picker). */
export function LeavePanel({ rows: allRows, people, employeeId, canEdit }: { rows: LeaveRow[]; people?: { id: string; name: string; code: string }[]; employeeId?: string; canEdit: boolean }) {
  // Cancelled leave is not listed (it stays in History).
  const rows = allRows.filter((l) => l.state !== "cancelled");
  const today = istDateKey(new Date());
  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex">
          <PopupForm label={<><CalendarCheck size={16} aria-hidden />Schedule leave</>} title="Schedule leave">
          <p className="muted">Every working day in the range is marked as leave. If they come back early and scan in, the leave ends the day before by itself.</p>
          <ActionForm action={scheduleLeave} className="grid gap-3 @container @md:grid-cols-2" submitLabel="Schedule leave" resetOnSuccess>
            {employeeId ? (
              <input type="hidden" name="employeeId" value={employeeId} />
            ) : (
              <div className="@md:col-span-2">
                <label className="label">Employee</label>
                <Select name="employeeId" defaultValue="" ariaLabel="Employee" options={[{ value: "", label: "Choose employee…" }, ...(people ?? []).map((e) => ({ value: e.id, label: `${e.name} (${e.code})` }))]} />
              </div>
            )}
            <div><label className="label">First day</label><DateInput name="fromDate" defaultValue={today} /></div>
            <div><label className="label">Last day</label><DateInput name="toDate" defaultValue={today} /></div>
            <div>
              <label className="label">Type</label>
              <Select name="paid" defaultValue="1" ariaLabel="Leave type" options={[{ value: "1", label: "Paid leave" }, { value: "0", label: "Unpaid leave" }]} />
            </div>
            <div><label className="label">Reason (optional)</label><input name="reason" className="input" placeholder="e.g. family function…" /></div>
          </ActionForm>
          </PopupForm>
        </div>
      )}
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr>{!employeeId && <th>Employee</th>}<th>Dates</th><th>Days</th><th>Type</th><th>Status</th>{canEdit && <th />}</tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const st = STATE[l.state];
              const active = l.status === "ACTIVE" && l.state !== "done";
              return (
                <tr key={l.id} className={l.state === "cancelled" ? "text-[var(--muted)]" : ""}>
                  {!employeeId && <td className="card-title font-medium">{l.employee} <span className="muted">{l.code}</span></td>}
                  <td data-label="Dates" className={employeeId ? "card-title font-medium" : ""}>
                    {formatDateKey(l.from)} – {formatDateKey(l.to)}
                    {l.plannedTo && l.status === "ACTIVE" && <div className="muted text-xs">Came back early (was until {formatDateKey(l.plannedTo)})</div>}
                    {l.reason && <div className="muted text-xs">{l.reason}</div>}
                  </td>
                  <td data-label="Days">{l.days}</td>
                  <td data-label="Type">{l.paid ? "Paid" : "Unpaid"}</td>
                  <td data-label="Status"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  {canEdit && (
                    <td>
                      {active && (
                        <div className="flex flex-wrap justify-end gap-2">
                          {l.state === "on_leave" && (
                            <details>
                              <summary className="btn-secondary !h-9 cursor-pointer">Came back early</summary>
                              <ActionForm action={endLeave} className="mt-2 flex min-w-56 flex-col gap-2" submitLabel="End leave">
                                <input type="hidden" name="leaveId" value={l.id} />
                                <label className="label !mb-0">Came back on</label>
                                <DateInput name="returnDate" defaultValue={today > l.from ? today : l.from} min={l.from} max={l.to} />
                              </ActionForm>
                            </details>
                          )}
                          <ActionForm action={cancelLeave} submitLabel="Cancel leave" submitClass="btn-secondary !h-9" confirm="Cancel this leave? The days go back to normal attendance.">
                            <input type="hidden" name="leaveId" value={l.id} />
                          </ActionForm>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">No leave scheduled.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
