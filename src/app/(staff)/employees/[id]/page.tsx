import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { removeFace, setEmployeeLeft, setEmployeeLogin } from "@/app/actions/employees";
import { ActionForm } from "@/components/ActionForm";
import { CalendarRange, LogIn, Pencil, ScanFace, Trash2, UserCog } from "@/components/icons";
import { PageHero, SectionTitle } from "@/components/PageHero";
import { FaceEnroll } from "@/components/FaceEnroll";
import { Tabs } from "@/components/Tabs";
import { requireStaff } from "@/lib/auth";
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
      <SectionTitle icon={<ScanFace size={18} />} ink="blue">Face for attendance</SectionTitle>
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
    ...(emp.cashWage > 0
      ? ([["Bank part", `${formatRs((emp.wageType === "MONTHLY" ? emp.monthlyWage : emp.dailyWage) - emp.cashWage)} (PF / ESIC on this)`], ["Cash part", formatRs(emp.cashWage)]] as [string, string][])
      : []),
    ["Basic for PF", `${emp.basicPercent}%`],
    ["PF", emp.pfEnabled ? `On${emp.uanNumber ? ` · UAN ${emp.uanNumber}` : " · UAN not added"}` : "Off"],
    ["ESIC", emp.esiEnabled ? `On${emp.esicNumber ? ` · IP ${emp.esicNumber}` : " · IP number not added"}` : "Off"],
    ["Attendance", emp.inHouse ? "In-house: present automatically on working days" : "Face scan"],
    ["Weekly off", emp.customWeeklyOff ? (emp.weeklyOffDays.map((d) => DAYS[d]).join(", ") || "None") : "Same as business"],
    // Bank details only for people allowed to see salary.
    ...(can(actor, "salary.edit") && (emp.bankAccountNumber || emp.upiId)
      ? ([
          ["Bank account", [emp.bankAccountName, emp.bankAccountNumber ? `A/c ${emp.bankAccountNumber}` : null].filter(Boolean).join(" · ") || "—"],
          ["IFSC", emp.bankIfsc ? `${emp.bankIfsc}${emp.bankName ? ` · ${emp.bankName}` : ""}${emp.bankBranch ? `, ${emp.bankBranch}` : ""}` : "—"],
          ["UPI", emp.upiId ?? "—"],
        ] as [string, string][])
      : []),
  ];
  const details = (
    <section className="card flex flex-col gap-3">
      <SectionTitle icon={<UserCog size={18} />} ink="violet" right={manage && <Link href={`/employees/${emp.id}/edit`} className="btn-secondary !h-8"><Pencil size={14} aria-hidden />Edit</Link>}>Details</SectionTitle>
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
        <SectionTitle icon={<LogIn size={18} />} ink="blue">Web login (view only)</SectionTitle>
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
        <SectionTitle icon={<Trash2 size={18} />} ink="red">{emp.active ? "Archive employee" : "Archived"}</SectionTitle>
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
        <PageHero
          avatar={emp.name}
          eyebrow={`${emp.code} · ${emp.site.name} · ${pay}`}
          title={emp.name}
          pills={[
            emp.active ? { label: "Active", tone: "ok" as const } : { label: "Archived" },
            ...(today ? [{ label: `Today: ${today.label}`, tone: today.status === "PRESENT" ? ("ok" as const) : today.status === "ABSENT" || today.status === "HALF_DAY" ? ("alert" as const) : undefined }] : []),
            ...(emp.inHouse ? [{ label: "In-house" }] : []),
            emp.faceId ? { label: "Face enrolled", tone: "ok" as const } : emp.inHouse ? { label: "Face not needed" } : { label: "No face", tone: "alert" as const },
          ]}
          valueLabel={h.balance < 0 ? "Employee owes" : "Salary to pay"}
          value={h.balance === 0 ? "Settled" : formatRs(Math.abs(h.balance))}
          stats={[
            { label: "Salary earned", value: formatRs(h.earned + h.extras) },
            { label: "Advances and paid", value: formatRs(h.advances + h.payments) },
          ]}
          actions={
            <>
              {manage && !emp.active && (
                <ActionForm action={setEmployeeLeft} submitLabel="Restore employee" submitClass="btn-secondary" confirm={`Restore ${emp.name}? They become active again; enroll the face again so they can scan.`}>
                  <input type="hidden" name="id" value={emp.id} />
                </ActionForm>
              )}
              {manage && <Link className="btn-secondary" href={`/employees/${emp.id}/edit`}><Pencil size={15} aria-hidden />Edit</Link>}
              <Link className="btn-secondary" href={`/attendance/register?month=${thisMonth}&employee=${emp.id}`}><CalendarRange size={15} aria-hidden />Attendance</Link>
            </>
          }
        />
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
