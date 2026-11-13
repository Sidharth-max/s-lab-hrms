import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { removeFace, setEmployeeLeft, setEmployeeLogin, updateEmployee } from "@/app/actions/employees";
import { giveAdvance } from "@/app/actions/advances";
import { ActionForm } from "@/components/ActionForm";
import { EmployeeFields } from "@/components/EmployeeFields";
import { FaceEnroll } from "@/components/FaceEnroll";
import { Tabs } from "@/components/Tabs";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRs, rsInput } from "@/lib/money";
import { can, canSeeSite } from "@/lib/permissions";
import { siteWhere } from "@/lib/scope";
import { employeeBalance, outstandingAdvances } from "@/lib/services";
import { dbToDateKey, formatDateKey, formatMonth, istDateKey, istMonthKey } from "@/lib/time";
import { DateInput, MonthInput, Select } from "@/components/controls";

export default async function EmployeePage({ params, searchParams }: PageProps<"/employees/[id]">) {
  const actor = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const emp = await db.employee.findFirst({ where: { id, businessId: actor.businessId }, include: { site: true, user: true } });
  if (!emp || !canSeeSite(actor, emp.siteId)) notFound();
  const [business, sites, advances, pendingAdvances, balance, lines] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
    db.site.findMany({ where: siteWhere(actor), orderBy: { name: "asc" } }),
    outstandingAdvances(emp.id),
    db.advance.findMany({ where: { employeeId: emp.id, status: "PENDING_APPROVAL" } }),
    employeeBalance(emp),
    db.payrollLine.findMany({ where: { employeeId: emp.id }, include: { run: true }, orderBy: { run: { month: "desc" } }, take: 12 }),
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
          : "Not enrolled. This person cannot use the scanner yet."}
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
        <div><div className="muted">Balance</div><div className={`text-lg font-semibold ${balance.balance < 0 ? "text-red-600" : ""}`}>{formatRs(balance.balance)}</div></div>
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
          {`${pendingAdvances.length} advance(s) waiting for owner approval.`}{" "}
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

  const details = manage ? (
    <section className="card">
      <h2 className="mb-3 font-semibold">Details and salary structure</h2>
      <ActionForm action={updateEmployee} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={emp.id} />
        <EmployeeFields
          sites={sites}
          isNew={false}
          canSalary={can(actor, "salary.edit")}
          businessWeeklyOff={business.weeklyOffDays}
          values={{
            name: emp.name,
            code: emp.code,
            phone: emp.phone,
            siteId: emp.siteId,
            joinedOn: dbToDateKey(emp.joinedOn),
            wageType: emp.wageType,
            wage: rsInput(emp.wageType === "MONTHLY" ? emp.monthlyWage : emp.dailyWage),
            basicPercent: emp.basicPercent,
            pfEnabled: emp.pfEnabled,
            esiEnabled: emp.esiEnabled,
            customWeeklyOff: emp.customWeeklyOff,
            weeklyOffDays: emp.weeklyOffDays,
          }}
        />
      </ActionForm>
    </section>
  ) : (
    <section className="card grid gap-2 text-sm">
      <div><span className="muted">{"Site"}:</span> {emp.site.name}</div>
      <div><span className="muted">{"Mobile"}:</span> {emp.phone ?? "—"}</div>
      <div><span className="muted">{"Pay"}:</span> {emp.wageType === "MONTHLY" ? `${formatRs(emp.monthlyWage)} ${"/ month"}` : `${formatRs(emp.dailyWage)} ${"/ day"}`}</div>
      <div><span className="muted">PF / ESIC:</span> {emp.pfEnabled ? "PF" : "—"} {emp.esiEnabled ? "ESIC" : ""}</div>
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
        <h2 className="font-semibold">{emp.active ? "Employee left" : "Rejoin"}</h2>
        <ActionForm
          action={setEmployeeLeft}
          submitLabel={emp.active ? "Mark as left" : "Make active again"}
          submitClass={emp.active ? "btn-danger" : "btn-secondary"}
          confirm={emp.active ? "Mark as left? Their face will be deleted. Attendance and salary history are kept." : undefined}
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
    { id: "face", label: "Face", content: face },
    { id: "advance", label: "Advance", content: advance },
    { id: "details", label: "Details", content: details },
    { id: "salary", label: "Salary", content: salary },
    ...(account ? [{ id: "account", label: "Login / Left", content: account }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <BackLink href="/employees" label="Employees" className="fold:hidden" />
          <h1 className="h1">{emp.name} <span className="text-base font-normal text-[var(--muted)]">{emp.code}</span></h1>
          {!emp.active && <span className="badge badge-neutral">{"Left on"} {emp.leftOn ? formatDateKey(dbToDateKey(emp.leftOn)) : ""}</span>}
        </div>
        <Link className="btn-secondary" href={`/attendance/register?month=${thisMonth}&employee=${emp.id}`}>Attendance register</Link>
      </div>
      {sp.created && (
        <div className="notice-green">
          {"Employee added. Now enroll the face in the Face tab."}
        </div>
      )}
      <Tabs tabs={tabs} initial={sp.advance ? "advance" : undefined} />
    </div>
  );
}
