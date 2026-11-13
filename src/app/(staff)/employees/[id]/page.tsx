import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { removeFace, setEmployeeLeft, setEmployeeLogin } from "@/app/actions/employees";
import { giveAdvance } from "@/app/actions/advances";
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
import { employeeBalance, outstandingAdvances, todayStatus } from "@/lib/services";
import { listLeaves } from "@/lib/leaves";
import { LeavePanel } from "@/components/LeavePanel";
import { dbToDateKey, formatDateKey, formatMonth, istDateKey, istMonthKey } from "@/lib/time";
import { DateInput, MonthInput, Select } from "@/components/controls";

export default async function EmployeePage({ params, searchParams }: PageProps<"/employees/[id]">) {
  const actor = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const emp = await db.employee.findFirst({ where: { id, businessId: actor.businessId }, include: { site: true, user: true } });
  if (!emp || !canSeeSite(actor, emp.siteId)) notFound();
  const [advances, pendingAdvances, balance, lines, today, leaves] = await Promise.all([
    outstandingAdvances(emp.id),
    db.advance.findMany({ where: { employeeId: emp.id, status: "PENDING_APPROVAL" } }),
    employeeBalance(emp),
    db.payrollLine.findMany({ where: { employeeId: emp.id }, include: { run: true }, orderBy: { run: { month: "desc" } }, take: 12 }),
    emp.active ? todayStatus(emp) : Promise.resolve(null),
    listLeaves(actor, { employeeId: emp.id }),
  ]);
  const manage = can(actor, "employees.manage");
  const thisMonth = istMonthKey(new Date());
  const open = advances.filter((a) => a.remaining > 0);

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

  const advance = (
    <section className="card flex flex-col gap-3">
      <h2 className="font-semibold">Advance balance</h2>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div><div className="muted">Earned this month</div><div className="text-lg font-semibold">{formatRs(balance.earned)}</div></div>
        <div><div className="muted">Advance to recover</div><div className="text-lg font-semibold">{formatRs(balance.outstanding)}</div></div>
        <div><div className="muted">Balance</div><div className={`text-lg font-semibold ${balance.balance < 0 ? "text-[var(--red)]" : ""}`}>{formatRs(balance.balance)}</div></div>
      </div>
      {open.length > 0 && (
        <table className="table table-cards">
          <thead><tr><th>Given</th><th>Amount</th><th>Recovered</th><th>Plan</th></tr></thead>
          <tbody>
            {open.map((a) => (
              <tr key={a.id}>
                <td data-label={"Given"}>{formatDateKey(dbToDateKey(a.givenOn))}</td>
                <td data-label={"Amount"}>{formatRs(a.amount)}</td>
                <td data-label={"Recovered"}>{formatRs(a.recovered)}</td>
                <td data-label={"Plan"}>
                  {a.recoveryMonths === 1 ? "Full" : `${a.recoveryMonths} months`} {"from"} {formatMonth(a.startMonth)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pendingAdvances.length > 0 && (
        <p className="text-sm text-[var(--red)]">
          {`${pendingAdvances.length} advance(s) waiting for approval.`}{" "}
          <Link className="underline" href="/approvals">Open approvals</Link>
        </p>
      )}
      {can(actor, "advances.manage") && emp.active && (
        <details className="rounded-lg border border-[var(--line)] p-3" open={!!sp.advance}>
          <summary className="cursor-pointer font-medium">Give advance</summary>
          <ActionForm action={giveAdvance} className="mt-3 grid gap-3 @md:grid-cols-2" submitLabel={"Save advance"} resetOnSuccess>
            <input type="hidden" name="employeeId" value={emp.id} />
            <div><label className="label">Amount (₹)</label><input name="amount" className="input" inputMode="decimal" required /></div>
            <div><label className="label">Date</label><DateInput name="givenOn" defaultValue={istDateKey(new Date())} max={istDateKey(new Date())} /></div>
            <div>
              <label className="label">Recover over</label>
              <Select
                name="recoveryMonths"
                defaultValue="1"
                ariaLabel="Recover over"
                options={[{ value: "1", label: "Full, this month end" }, ...[2, 3, 4, 6].map((n) => ({ value: String(n), label: `${n} months` })), { value: "12", label: "12 months (1 year)" }]}
              />
            </div>
            <div><label className="label">First recovery month</label><MonthInput name="startMonth" defaultValue={thisMonth} /></div>
            <div className="@md:col-span-2"><label className="label">Note (optional)</label><input name="note" className="input" /></div>
          </ActionForm>
        </details>
      )}
    </section>
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

  const salary = (
    <section className="card overflow-x-auto">
      <h2 className="mb-3 font-semibold">Salary history</h2>
      <table className="table table-cards">
        <thead><tr><th>Month</th><th>Days</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Paid</th><th /></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="card-title font-medium">{formatMonth(l.run.month)} {l.run.status === "DRAFT" && <span className="badge badge-neutral">draft</span>}</td>
              <td data-label={"Days"}>{l.payableDays}</td>
              <td data-label={"Gross"}>{formatRs(l.gross)}</td>
              <td data-label={"Deductions"}>{formatRs(l.pfEmployee + l.esiEmployee + l.advanceRecovered)}</td>
              <td data-label={"Net"} className="font-semibold">{formatRs(l.net)}</td>
              <td data-label={"Paid"}>{l.paidAmount ? formatRs(l.paidAmount) : "—"}</td>
              <td><Link className="link" href={`/payslip/${l.id}`}>Payslip</Link></td>
            </tr>
          ))}
          {lines.length === 0 && <tr><td colSpan={7} className="muted">No salary prepared yet.</td></tr>}
        </tbody>
      </table>
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
          confirm={emp.active ? `Archive this employee? Their face will be deleted and planned leave ends. Attendance and salary history are kept.${balance.outstanding > 0 ? ` Note: ${formatRs(balance.outstanding)} advance is still to be recovered.` : ""}` : undefined}
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
    { id: "face", label: "Face", content: face },
    { id: "advance", label: "Advance", content: advance },
    { id: "salary", label: "Salary", content: salary },
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
            ["Earned this month", formatRs(balance.earned), ""],
            ["Advance to recover", formatRs(balance.outstanding), ""],
            ["Balance", formatRs(balance.balance), balance.balance < 0 ? "text-[var(--red)]" : ""],
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
      <Tabs tabs={tabs} initial={sp.advance ? "advance" : sp.created ? "face" : undefined} />
    </div>
  );
}
