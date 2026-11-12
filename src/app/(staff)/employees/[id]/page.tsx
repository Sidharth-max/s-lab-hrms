import Link from "next/link";
import { notFound } from "next/navigation";
import { removeFace, setEmployeeLeft, setEmployeeLogin, updateEmployee } from "@/app/actions/employees";
import { giveAdvance } from "@/app/actions/advances";
import { ActionForm } from "@/components/ActionForm";
import { EmployeeFields } from "@/components/EmployeeFields";
import { FaceEnroll } from "@/components/FaceEnroll";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRs, rsInput } from "@/lib/money";
import { can, canSeeSite } from "@/lib/permissions";
import { siteWhere } from "@/lib/scope";
import { employeeBalance, outstandingAdvances } from "@/lib/services";
import { dbToDateKey, formatDateKey, formatMonth, istDateKey, istMonthKey } from "@/lib/time";

export default async function EmployeePage({ params, searchParams }: PageProps<"/employees/[id]">) {
  const actor = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const emp = await db.employee.findFirst({ where: { id, businessId: actor.businessId }, include: { site: true, user: true } });
  if (!emp || !canSeeSite(actor, emp.siteId)) notFound();
  const [sites, advances, pendingAdvances, balance, lines] = await Promise.all([
    db.site.findMany({ where: siteWhere(actor), orderBy: { name: "asc" } }),
    outstandingAdvances(emp.id),
    db.advance.findMany({ where: { employeeId: emp.id, status: "PENDING_APPROVAL" } }),
    employeeBalance(emp),
    db.payrollLine.findMany({ where: { employeeId: emp.id }, include: { run: true }, orderBy: { run: { month: "desc" } }, take: 12 }),
  ]);
  const manage = can(actor, "employees.manage");
  const thisMonth = istMonthKey(new Date());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/employees" className="muted underline">← Employees</Link>
          <h1 className="h1">{emp.name} <span className="text-base font-normal text-[var(--muted)]">{emp.code}</span></h1>
          {!emp.active && <span className="badge bg-gray-200">Left on {emp.leftOn ? formatDateKey(dbToDateKey(emp.leftOn)) : ""}</span>}
        </div>
        <Link className="btn-secondary" href={`/attendance/register?month=${thisMonth}&employee=${emp.id}`}>Attendance register</Link>
      </div>
      {sp.created && <div className="card border-green-200 bg-green-50 text-sm text-green-800">Employee added. Now enroll the face below.</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Face for attendance</h2>
          <p className="muted">
            {emp.faceId ? `Enrolled on ${emp.faceEnrolledAt?.toLocaleDateString("en-IN")}` : "Not enrolled. This person cannot use the scanner yet."}
          </p>
          {manage && emp.active && <FaceEnroll employeeId={emp.id} enrolled={!!emp.faceId} />}
          {manage && emp.faceId && (
            <ActionForm action={removeFace} submitLabel="Remove face" submitClass="btn-secondary" confirm="Remove this face? The employee will not be able to scan.">
              <input type="hidden" name="id" value={emp.id} />
            </ActionForm>
          )}
        </section>

        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Advance balance</h2>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><div className="muted">Earned this month</div><div className="text-lg font-semibold">{formatRs(balance.earned)}</div></div>
            <div><div className="muted">Advance to recover</div><div className="text-lg font-semibold">{formatRs(balance.outstanding)}</div></div>
            <div><div className="muted">Balance</div><div className={`text-lg font-semibold ${balance.balance < 0 ? "text-red-600" : ""}`}>{formatRs(balance.balance)}</div></div>
          </div>
          {advances.filter((a) => a.remaining > 0).length > 0 && (
            <table className="table">
              <thead><tr><th>Given</th><th>Amount</th><th>Recovered</th><th>Plan</th></tr></thead>
              <tbody>
                {advances.filter((a) => a.remaining > 0).map((a) => (
                  <tr key={a.id}>
                    <td>{formatDateKey(dbToDateKey(a.givenOn))}</td>
                    <td>{formatRs(a.amount)}</td>
                    <td>{formatRs(a.recovered)}</td>
                    <td>{a.recoveryMonths === 1 ? "Full" : `${a.recoveryMonths} months`} from {formatMonth(a.startMonth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {pendingAdvances.length > 0 && (
            <p className="text-sm text-amber-700">
              {pendingAdvances.length} advance(s) waiting for owner approval. <Link className="underline" href="/approvals">Open approvals</Link>
            </p>
          )}
          {can(actor, "advances.manage") && emp.active && (
            <details className="rounded-lg border border-[var(--line)] p-3">
              <summary className="cursor-pointer font-medium">Give advance</summary>
              <ActionForm action={giveAdvance} className="mt-3 grid gap-3 sm:grid-cols-2" submitLabel="Save advance" resetOnSuccess>
                <input type="hidden" name="employeeId" value={emp.id} />
                <div><label className="label">Amount (₹)</label><input name="amount" className="input" inputMode="decimal" required /></div>
                <div><label className="label">Date</label><input name="givenOn" type="date" className="input" defaultValue={istDateKey(new Date())} /></div>
                <div>
                  <label className="label">Recover over</label>
                  <select name="recoveryMonths" className="input" defaultValue="1">
                    <option value="1">Full, this month end</option>
                    <option value="2">2 months</option>
                    <option value="3">3 months</option>
                    <option value="4">4 months</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months (1 year)</option>
                  </select>
                </div>
                <div><label className="label">First recovery month</label><input name="startMonth" type="month" className="input" defaultValue={thisMonth} /></div>
                <div className="sm:col-span-2"><label className="label">Note (optional)</label><input name="note" className="input" /></div>
              </ActionForm>
            </details>
          )}
        </section>
      </div>

      {manage && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Details and salary structure</h2>
          <ActionForm action={updateEmployee} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={emp.id} />
            <EmployeeFields
              sites={sites}
              isNew={false}
              canSalary={can(actor, "salary.edit")}
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
              }}
            />
          </ActionForm>
        </section>
      )}

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Salary history</h2>
        <table className="table">
          <thead><tr><th>Month</th><th>Days</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Paid</th><th /></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{formatMonth(l.run.month)} {l.run.status === "DRAFT" && <span className="badge bg-gray-100">draft</span>}</td>
                <td>{l.payableDays}</td>
                <td>{formatRs(l.gross)}</td>
                <td>{formatRs(l.pfEmployee + l.esiEmployee + l.advanceRecovered)}</td>
                <td className="font-semibold">{formatRs(l.net)}</td>
                <td>{l.paidAmount ? formatRs(l.paidAmount) : "—"}</td>
                <td><Link className="text-[var(--brand)] underline" href={`/payslip/${l.id}`}>Payslip</Link></td>
              </tr>
            ))}
            {lines.length === 0 && <tr><td colSpan={7} className="muted">No salary prepared yet.</td></tr>}
          </tbody>
        </table>
      </section>

      {manage && (
        <div className="grid gap-4 lg:grid-cols-2">
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
              {emp.active && <div><label className="label">Last working day</label><input type="date" name="leftOn" className="input" required defaultValue={istDateKey(new Date())} /></div>}
            </ActionForm>
          </section>
        </div>
      )}
    </div>
  );
}
