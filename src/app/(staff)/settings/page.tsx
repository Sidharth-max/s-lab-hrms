import { addHoliday, addSite, removeHoliday, toggleSite, updateSettings } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbToDateKey, formatDateKey } from "@/lib/time";
import { parseDayRules } from "@/lib/day-rules";
import { DateInput, TimeInput } from "@/components/controls";

export default async function SettingsPage() {
  const actor = await requireStaff("settings.manage");
  const DAYS = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday",
  ];
  const [b, sites, holidays] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
    db.site.findMany({ where: { businessId: actor.businessId }, orderBy: { name: "asc" } }),
    db.holiday.findMany({ where: { businessId: actor.businessId }, orderBy: { date: "desc" }, take: 60 }),
  ]);
  const dayRules = parseDayRules(b.dayRules);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Settings</h1>
      <section className="card">
        <h2 className="mb-3 font-semibold">Business and attendance rules</h2>
        <ActionForm action={updateSettings} className="flex flex-col gap-4">
          <div className="grid gap-3 @2xl:grid-cols-2">
            <div><label className="label">Business name</label><input name="name" className="input" defaultValue={b.name} required /></div>
            <div>
              <label className="label">Ignore repeat scans within (minutes)</label>
              <input name="duplicateScanMins" type="number" min={1} max={60} className="input" defaultValue={b.duplicateScanMins} />
            </div>
            <div>
              <label className="label">Longest shift (hours). A scan after this starts a new day.</label>
              <input name="maxShiftHours" type="number" min={4} max={24} className="input" defaultValue={b.maxShiftHours} />
            </div>
          </div>
          <h3 className="font-semibold">Weekly schedule</h3>
          <p className="muted -mt-3">
            {"Weekly off: paid day off for monthly staff (an employee can have their own days, set on the employee). Half day: worked less than these hours. Any scan = full day: for short days like Sunday."}
          </p>
          <div className="overflow-x-auto">
            <table className="table table-cards">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Weekly off</th>
                  <th>Opens</th>
                  <th>Closes</th>
                  <th>Half day below (hours, 0 = never)</th>
                  <th>Any scan = full day</th>
                </tr>
              </thead>
              <tbody>
                {dayRules.map((r, i) => (
                  <tr key={i}>
                    <td className="card-title font-medium">{DAYS[i]}</td>
                    <td data-label={"Weekly off"}>
                      <input type="checkbox" name={`off_${i}`} defaultChecked={b.weeklyOffDays.includes(i)} className="h-5 w-5" />
                    </td>
                    <td data-label={"Opens"}><TimeInput name={`open_${i}`} defaultValue={r.open} className="w-36" /></td>
                    <td data-label={"Closes"}><TimeInput name={`close_${i}`} defaultValue={r.close} className="w-36" /></td>
                    <td data-label={"Half day below (hours)"}>
                      <input type="number" name={`half_${i}`} step="0.5" min={0} max={12} defaultValue={r.halfDayBelowMins / 60} className="input !w-24" />
                    </td>
                    <td data-label={"Any scan = full day"}>
                      <input type="checkbox" name={`any_${i}`} defaultChecked={r.anyScanFullDay} className="h-5 w-5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="font-semibold">PF and ESIC rates</h3>
          <p className="muted -mt-3">
            {"Used only for employees with PF / ESIC switched on. Check the current official rates with your accountant."}
          </p>
          <div className="grid gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">
            <div><label className="label">PF employee %</label><input name="pfEmployeePct" type="number" step="0.01" className="input" defaultValue={b.pfEmployeeBps / 100} /></div>
            <div><label className="label">PF employer %</label><input name="pfEmployerPct" type="number" step="0.01" className="input" defaultValue={b.pfEmployerBps / 100} /></div>
            <div><label className="label">PF wage ceiling ₹ (PF is worked out on basic up to this amount)</label><input name="pfWageCeiling" type="number" className="input" defaultValue={b.pfWageCeiling / 100} /></div>
            <div><label className="label">ESIC employee %</label><input name="esiEmployeePct" type="number" step="0.01" className="input" defaultValue={b.esiEmployeeBps / 100} /></div>
            <div><label className="label">ESIC employer %</label><input name="esiEmployerPct" type="number" step="0.01" className="input" defaultValue={b.esiEmployerBps / 100} /></div>
          </div>
        </ActionForm>
      </section>

      <div className="grid gap-4 @4xl:grid-cols-2">
        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Sites / branches</h2>
          <ul className="flex flex-col gap-2">
            {sites.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span className={s.active ? "" : "text-[var(--muted)] line-through"}>{s.name}</span>
                <ActionForm action={toggleSite} submitLabel={s.active ? "Disable" : "Enable"} submitClass="btn-secondary !py-1">
                  <input type="hidden" name="siteId" value={s.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
          <ActionForm action={addSite} className="flex gap-2" submitLabel={"Add site"} resetOnSuccess>
            <input name="name" className="input" placeholder={"New site name"} required />
          </ActionForm>
        </section>

        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Holidays (paid for monthly staff)</h2>
          <ActionForm action={addHoliday} className="flex flex-wrap gap-2" submitLabel={"Add"} resetOnSuccess>
            <DateInput name="date" className="w-44" />
            <input name="name" className="input max-w-[14rem]" placeholder={"Holiday name"} required />
          </ActionForm>
          <ul className="flex flex-col gap-1">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{formatDateKey(dbToDateKey(h.date))} · {h.name}</span>
                <ActionForm action={removeHoliday} submitLabel={"Remove"} submitClass="btn-secondary !py-1">
                  <input type="hidden" name="holidayId" value={h.id} />
                </ActionForm>
              </li>
            ))}
            {holidays.length === 0 && <li className="muted">No holidays added.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
