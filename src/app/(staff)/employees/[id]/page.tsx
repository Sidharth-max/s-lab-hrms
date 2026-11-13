import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { removeFace, setEmployeeLeft, setEmployeeLogin } from "@/app/actions/employees";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { CalendarRange, Pencil } from "@/components/icons";
import { FaceEnroll } from "@/components/FaceEnroll";
import { Tabs } from "@/components/Tabs";
import { requireStaff } from "@/lib/auth";
import { statusBadgeClass } from "@/lib/attendance";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { can, canSeeSite } from "@/lib/permissions";
import { todayStatus } from "@/lib/services";
import { hisaabOf } from "@/lib/ledger";
import { balanceText, HisaabPanel } from "@/components/HisaabPanel";
import { listLeaves } from "@/lib/leaves";
import { LeavePanel } from "@/components/LeavePanel";
import { dbToDateKey, formatDateKey, istDateKey, istMonthKey } from "@/lib/time";
import { DateInput } from "@/components/controls";

export default async function EmployeePage({ params, searchParams }: PageProps<"/employees/[id]">) {
  const actor = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const emp = await db.employee.findFirst({ where: { id, businessId: actor.businessId }, include: { site: true, user: true } });
  if (!emp || !canSeeSite(actor, emp.siteId)) notFound();
  const [h, wageRows, today, leaves] = await Promise.all([
    hisaabOf(emp),
    db.wageChange.findMany({ where: { employeeId: emp.id }, orderBy: { effectiveFrom: "desc" } }),
    emp.active ? todayStatus(emp) : Promise.resolve(null),
    listLeaves(actor, { employeeId: emp.id }),
  ]);
  const manage = can(actor, "employees.manage");
  const thisMonth = istMonthKey(new Date());
  const wages = wageRows.map((w) => ({ from: dbToDateKey(w.effectiveFrom), text: w.wageType === "MONTHLY" ? `${formatRs(w.monthlyWage)} / month` : `${formatRs(w.dailyWage)} / day` }));

  const face = (
    <section className="card flex flex-col gap-3">
      <h2 className="font-semibold">Face for attendance</h2>
      <p className="muted">
        {emp.faceId
          ? `Enrolled on ${emp.faceEnrolledAt?.toLocaleDateString("en-IN")}`
          : emp.inHouse ? "Not needed: in-house staff are marked present automatically. Enroll a face only if they should also scan." : "Not enrolled. This person cannot use the scanner yet."}
      </p>
      {manage && emp.active && <FaceEnroll employeeId={emp.id} enrolled={!!emp.faceId} />}
      {manage && emp.faceId && (
        <ActionForm
          action={removeFace}
          submitLabel={"Remove face"}
          submitClass="btn-secondary"
          confirm={"Remove this face? The employee will not be able to scan."}
        >
          <input type="hidden" name="id" value={emp.id} />
        </ActionForm>
      )}
    </section>
  );

  const hisaab = (
    <HisaabPanel
      h={h}
      employee={{ id: emp.id, name: emp.name, active: emp.active }}
      wages={wages}
      openAdvance={!!sp.advance}
      can={{ pay: can(actor, "payroll.lock"), extras: can(actor, "payroll.run"), advance: can(actor, "advances.manage"), owner: actor.role === "OWNER" }}
    />
  );

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const pay = emp.wageType === "MONTHLY" ? `${formatRs(emp.monthlyWage)} / month` : `${formatRs(emp.dailyWage)} / day`;
  const facts: [string, string][] = [
    ["Employee code", emp.code],
    ["Site", emp.site.name],
    ["Mobile", emp.phone ?? "—"],
    ["Joined", formatDateKey(dbToDateKey(emp.joinedOn))],
    ["Pay", pay],
    ["Basic for PF", `${emp.basicPercent}%`],
    ["PF", emp.pfEnabled ? `On${emp.uanNumber ? ` · UAN ${emp.uanNumber}` : " · UAN not added"}` : "Off"],
    ["ESIC", emp.esiEnabled ? `On${emp.esicNumber ? ` · IP ${emp.esicNumber}` : " · IP number not added"}` : "Off"],
    ["Attendance", emp.inHouse ? "In-house: present automatically on working days" : "Face scan"],
    ["Weekly off", emp.customWeeklyOff ? (emp.weeklyOffDays.map((d) => DAYS[d]).join(", ") || "None") : "Same as business"],
  ];
  const details = (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Details</h2>
        {manage && <Link href={`/employees/${emp.id}/edit`} className="btn-secondary !h-8"><Pencil size={14} aria-hidden />Edit</Link>}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm @md:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] pb-2 last:border-0">
            <dt className="text-[var(--muted)]">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  const account = manage ? (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">Web login (view only)</h2>
        <p className="muted">
          {emp.user?.active
            ? `On. ${emp.name} can log in at the website with ${emp.phone} and see salary, attendance and advances.`
            : "Off. Turn on so the employee can view their own salary on the website."}
        </p>
        <ActionForm action={setEmployeeLogin} submitLabel={emp.user?.active ? "Turn off web login" : "Turn on web login"} submitClass="btn-secondary">
          <input type="hidden" name="id" value={emp.id} />
          <input type="hidden" name="enable" value={emp.user?.active ? "0" : "1"} />
        </ActionForm>
      </section>
      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">{emp.active ? "Archive employee" : "Archived"}</h2>
        <p className="muted">
          {emp.active
            ? "When someone stops working here, archive them. Their face is deleted so they cannot scan; attendance, salary and advance history stay."
            : `Archived on ${emp.leftOn ? formatDateKey(dbToDateKey(emp.leftOn)) : ""}. Restore to make them active again (enroll the face again after).`}
        </p>
        <ActionForm
          action={setEmployeeLeft}
          submitLabel={emp.active ? "Archive employee" : "Restore employee"}
          submitClass={emp.active ? "btn-danger" : "btn-primary"}
          confirm={emp.active ? `Archive this employee? Their face will be deleted and planned leave ends. Attendance and salary history are kept.${h.balance !== 0 ? ` Salary ledger: ${balanceText(h.balance)}.` : ""}` : undefined}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={emp.id} />
          {emp.active && (
            <div><label className="label">Last working day</label><DateInput name="leftOn" defaultValue={istDateKey(new Date())} /></div>
          )}
        </ActionForm>
      </section>
    </div>
  ) : null;

  const tabs = [
    { id: "details", label: "Overview", content: details },
    { id: "ledger", label: "Ledger", content: hisaab },
    { id: "face", label: "Face", content: face },
    { id: "leave", label: "Leave", content: <LeavePanel rows={leaves} employeeId={emp.id} canEdit={can(actor, "attendance.edit") && emp.active} /> },
    ...(account ? [{ id: "account", label: "Access & archive", content: account }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <BackLink href="/employees" label="Employees" className="fold:hidden" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={emp.name} size={48} muted={!emp.active} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="h1 truncate">{emp.name}</h1>
                {emp.active ? <span className="badge badge-neutral">Active</span> : <span className="badge badge-neutral">Archived</span>}
                {emp.inHouse && <span className="badge badge-neutral">In-house</span>}
                {today && (
                  <span className={statusBadgeClass(today.status)}>
                    Today: {today.label}
                  </span>
                )}
              </div>
              <p className="muted">{emp.code} · {emp.site.name} · {pay}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {manage && !emp.active && (
              <ActionForm action={setEmployeeLeft} submitLabel="Restore employee" submitClass="btn-primary" confirm={`Restore ${emp.name}? They become active again; enroll the face again so they can scan.`}>
                <input type="hidden" name="id" value={emp.id} />
              </ActionForm>
            )}
            {manage && <Link className={emp.active ? "btn-primary" : "btn-secondary"} href={`/employees/${emp.id}/edit`}><Pencil size={15} aria-hidden />Edit</Link>}
            <Link className="btn-secondary" href={`/attendance/register?month=${thisMonth}&employee=${emp.id}`}><CalendarRange size={15} aria-hidden />Attendance</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
          {[
            ["Face", emp.faceId ? "Enrolled" : emp.inHouse ? "Not needed (in-house)" : "Not enrolled", emp.faceId || emp.inHouse ? "" : "text-[var(--red)]"],
            ["Salary earned", formatRs(h.earned + h.extras), ""],
            ["Advances and paid", formatRs(h.advances + h.payments), ""],
            [h.balance < 0 ? "Employee owes" : "Balance to pay", formatRs(Math.abs(h.balance)), h.balance < 0 ? "text-[var(--red)]" : ""],
          ].map(([k, v, cls]) => (
            <div key={k} className="card !p-3">
              <div className="text-xs text-[var(--muted)]">{k}</div>
              <div className={`mt-0.5 text-base font-semibold tracking-tight ${cls}`}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      {sp.saved && <div className="notice-green">Changes saved.</div>}
      {sp.created && (
        <div className="notice-green">
          {"Employee added. Now enroll the face in the Face tab."}
        </div>
      )}
      <Tabs tabs={tabs} initial={sp.advance || sp.tab === "ledger" || sp.tab === "hisaab" ? "ledger" : sp.created ? "face" : undefined} />
    </div>
  );
}
