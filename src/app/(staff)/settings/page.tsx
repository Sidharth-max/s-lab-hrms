import Link from "next/link";
import { addHoliday, addSite, removeHoliday, removeShift, toggleSite, updateSettings } from "@/app/actions/admin";
import { scheduleSummary, SCHEDULE_HELP, WeekSchedule } from "@/components/WeekSchedule";
import { ActionForm } from "@/components/ActionForm";
import { SectionTitle } from "@/components/PageHero";
import { Building, CalendarDays, Clock, Plus, Settings } from "@/components/icons";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbToDateKey, formatDateKey } from "@/lib/time";
import { parseDayRules } from "@/lib/day-rules";

import { DateInput } from "@/components/controls";

export default async function SettingsPage() {
  const actor = await requireStaff("settings.manage");
  const [b, sites, holidays, shifts] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
    db.site.findMany({ where: { businessId: actor.businessId }, orderBy: { name: "asc" } }),
    db.holiday.findMany({ where: { businessId: actor.businessId }, orderBy: { date: "desc" }, take: 60 }),
    db.shift.findMany({ where: { businessId: actor.businessId, active: true }, orderBy: { name: "asc" }, include: { _count: { select: { employees: { where: { active: true } } } } } }),
  ]);
  const dayRules = parseDayRules(b.dayRules);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Settings</h1>
      <section className="card">
        <SectionTitle icon={<Settings size={18} />} ink="green">Business and attendance rules</SectionTitle>
        <ActionForm action={updateSettings} className="flex flex-col gap-4" submitLabel="Save settings" sticky>
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
          <h3 className="font-semibold">Business hours (staff without a shift)</h3>
          <p className="muted -mt-3">{SCHEDULE_HELP} An employee can have their own weekly off, set on the employee.</p>
          <WeekSchedule rules={dayRules} weeklyOff={b.weeklyOffDays} />
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

      <section id="shifts" className="card flex flex-col gap-3 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={<Clock size={18} />} ink="teal">Shifts</SectionTitle>
          <Link href="/settings/shifts/new" className="btn-primary"><Plus size={18} /> New shift</Link>
        </div>
        <p className="muted">{"Create shifts with their own times, grace in / out and weekly off (e.g. Morning, Night). Choose a shift on each employee; staff without one follow the business hours above."}</p>
        <ul className="flex flex-col gap-2">
          {shifts.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] p-3">
              <Link href={`/settings/shifts/${s.id}`} className="min-w-0 flex-1">
                <span className="font-semibold">{s.name}</span>
                <span className="muted block text-sm">{scheduleSummary(parseDayRules(s.dayRules), s.weeklyOffDays)} · {s._count.employees} staff</span>
              </Link>
              <div className="flex gap-2">
                <Link href={`/settings/shifts/${s.id}`} className="btn-secondary !py-1">Edit</Link>
                <ActionForm action={removeShift} submitLabel="Remove" submitClass="btn-secondary !py-1" confirm={`Remove ${s.name}? Its ${s._count.employees} staff go back to the business hours, and their past days are worked out again with those hours.`}>
                  <input type="hidden" name="shiftId" value={s.id} />
                </ActionForm>
              </div>
            </li>
          ))}
          {shifts.length === 0 && <li className="muted">{"No shifts yet. Everyone follows the business hours."}</li>}
        </ul>
      </section>

      <div className="grid gap-4 @4xl:grid-cols-2">
        <section className="card flex flex-col gap-3">
          <SectionTitle icon={<Building size={18} />} ink="blue">Sites / branches</SectionTitle>
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
          <SectionTitle icon={<CalendarDays size={18} />} ink="orange">Holidays (paid for monthly staff)</SectionTitle>
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
