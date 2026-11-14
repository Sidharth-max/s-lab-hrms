import Link from "next/link";
import { notFound } from "next/navigation";
import { saveShiftAndReturn } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { PageHero } from "@/components/PageHero";
import { ArrowLeft, Clock } from "@/components/icons";
import { SCHEDULE_HELP, WeekSchedule } from "@/components/WeekSchedule";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDayRules } from "@/lib/day-rules";

/** Create (id = "new") or edit a shift: name, per-weekday times, grace in / out and weekly off. */
export default async function ShiftPage({ params }: PageProps<"/settings/shifts/[id]">) {
  const actor = await requireStaff("settings.manage");
  const { id } = await params;
  const business = await db.business.findUniqueOrThrow({ where: { id: actor.businessId } });
  const shift = id === "new" ? null : await db.shift.findFirst({ where: { id, businessId: actor.businessId, active: true }, include: { employees: { where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } } } });
  if (id !== "new" && !shift) notFound();
  // A new shift starts from the business hours.
  const rules = parseDayRules(shift ? shift.dayRules : business.dayRules);
  const weeklyOff = shift ? shift.weeklyOffDays : business.weeklyOffDays;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/settings#shifts" className="muted inline-flex items-center gap-1 text-sm"><ArrowLeft size={16} /> Settings</Link>
      <PageHero
        icon={<Clock size={24} />}
        eyebrow="Shift"
        title={shift ? shift.name : "New shift"}
        subtitle={shift ? `${shift.employees.length} staff on this shift` : "Set the times, grace periods and weekly off"}
      />
      <section className="card">
        <ActionForm action={saveShiftAndReturn} className="flex flex-col gap-4" submitLabel={shift ? "Save shift" : "Add shift"} sticky>
          {shift && <input type="hidden" name="shiftId" value={shift.id} />}
          <div className="max-w-md">
            <label className="label" htmlFor="shift-name">Shift name</label>
            <input id="shift-name" name="name" className="input" defaultValue={shift?.name ?? ""} placeholder="e.g. Morning, Night" required maxLength={40} />
          </div>
          <p className="muted">{SCHEDULE_HELP} An employee&apos;s own weekly off, if set, wins over the shift&apos;s.</p>
          <WeekSchedule rules={rules} weeklyOff={weeklyOff} />
        </ActionForm>
      </section>
      {shift && shift.employees.length > 0 && (
        <section className="card flex flex-col gap-2">
          <h2 className="font-semibold">Staff on this shift</h2>
          <div className="flex flex-wrap gap-2">
            {shift.employees.map((e) => (
              <Link key={e.id} href={`/employees/${e.id}`} className="badge badge-green">{e.name}</Link>
            ))}
          </div>
          <p className="muted text-sm">{"Change an employee's shift on their Edit page."}</p>
        </section>
      )}
    </div>
  );
}
