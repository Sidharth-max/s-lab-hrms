import { addHoliday, addSite, removeHoliday, toggleSite, updateSettings } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbToDateKey, formatDateKey } from "@/lib/time";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SettingsPage() {
  const actor = await requireStaff("settings.manage");
  const [b, sites, holidays] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
    db.site.findMany({ where: { businessId: actor.businessId }, orderBy: { name: "asc" } }),
    db.holiday.findMany({ where: { businessId: actor.businessId }, orderBy: { date: "desc" }, take: 60 }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Settings</h1>
      <section className="card">
        <h2 className="mb-3 font-semibold">Business and attendance rules</h2>
        <ActionForm action={updateSettings} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Business name</label><input name="name" className="input" defaultValue={b.name} required /></div>
            <div>
              <label className="label">Weekly off (paid for monthly staff)</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="weeklyOffDays" value={i} defaultChecked={b.weeklyOffDays.includes(i)} /> {d.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
            <div><label className="label">Half day if worked less than (hours, 0 = off)</label><input name="halfDayBelowHours" type="number" step="0.5" min={0} max={12} className="input" defaultValue={b.halfDayBelowMins / 60} /></div>
            <div><label className="label">Ignore repeat scans within (minutes)</label><input name="duplicateScanMins" type="number" min={1} max={60} className="input" defaultValue={b.duplicateScanMins} /></div>
            <div><label className="label">Longest shift (hours). A scan after this starts a new day.</label><input name="maxShiftHours" type="number" min={4} max={24} className="input" defaultValue={b.maxShiftHours} /></div>
          </div>
          <h3 className="font-semibold">PF and ESIC rates</h3>
          <p className="muted -mt-3">Used only for employees with PF / ESIC switched on. Check the current official rates with your accountant.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label">PF employee %</label><input name="pfEmployeePct" type="number" step="0.01" className="input" defaultValue={b.pfEmployeeBps / 100} /></div>
            <div><label className="label">PF employer %</label><input name="pfEmployerPct" type="number" step="0.01" className="input" defaultValue={b.pfEmployerBps / 100} /></div>
            <div><label className="label">PF wage ceiling ₹ (PF is worked out on basic up to this amount)</label><input name="pfWageCeiling" type="number" className="input" defaultValue={b.pfWageCeiling / 100} /></div>
            <div><label className="label">ESIC employee %</label><input name="esiEmployeePct" type="number" step="0.01" className="input" defaultValue={b.esiEmployeeBps / 100} /></div>
            <div><label className="label">ESIC employer %</label><input name="esiEmployerPct" type="number" step="0.01" className="input" defaultValue={b.esiEmployerBps / 100} /></div>
          </div>
        </ActionForm>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
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
          <ActionForm action={addSite} className="flex gap-2" submitLabel="Add site" resetOnSuccess>
            <input name="name" className="input" placeholder="New site name" required />
          </ActionForm>
        </section>

        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Holidays (paid for monthly staff)</h2>
          <ActionForm action={addHoliday} className="flex flex-wrap gap-2" submitLabel="Add" resetOnSuccess>
            <input name="date" type="date" className="input max-w-[11rem]" required />
            <input name="name" className="input max-w-[14rem]" placeholder="Holiday name" required />
          </ActionForm>
          <ul className="flex flex-col gap-1">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{formatDateKey(dbToDateKey(h.date))} · {h.name}</span>
                <ActionForm action={removeHoliday} submitLabel="Remove" submitClass="btn-secondary !py-1">
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
