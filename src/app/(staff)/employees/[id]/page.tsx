import Link from "next/link";
import { notFound } from "next/navigation";
import { removeFace, setEmployeeLeft, setEmployeeLogin, updateEmployee } from "@/app/actions/employees";
import { giveAdvance } from "@/app/actions/advances";
import { ActionForm } from "@/components/ActionForm";
import { EmployeeFields } from "@/components/EmployeeFields";
import { FaceEnroll } from "@/components/FaceEnroll";
import { Tabs } from "@/components/Tabs";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { formatRs, rsInput } from "@/lib/money";
import { can, canSeeSite } from "@/lib/permissions";
import { siteWhere } from "@/lib/scope";
import { employeeBalance, outstandingAdvances } from "@/lib/services";
import { dbToDateKey, formatDateKey, formatMonth, istDateKey, istMonthKey } from "@/lib/time";

export default async function EmployeePage({ params, searchParams }: PageProps<"/employees/[id]">) {
  const actor = await requireStaff();
  const { t } = await getT();
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
      <h2 className="font-semibold">{t("Face for attendance", "हाज़िरी के लिए चेहरा")}</h2>
      <p className="muted">
        {emp.faceId
          ? t(`Enrolled on ${emp.faceEnrolledAt?.toLocaleDateString("en-IN")}`, `${emp.faceEnrolledAt?.toLocaleDateString("en-IN")} को दर्ज किया`)
          : t("Not enrolled. This person cannot use the scanner yet.", "दर्ज नहीं है। यह व्यक्ति अभी स्कैनर इस्तेमाल नहीं कर सकता।")}
      </p>
      {manage && emp.active && <FaceEnroll employeeId={emp.id} enrolled={!!emp.faceId} />}
      {manage && emp.faceId && (
        <ActionForm
          action={removeFace}
          submitLabel={t("Remove face", "चेहरा हटाएं")}
          submitClass="btn-secondary"
          confirm={t("Remove this face? The employee will not be able to scan.", "चेहरा हटाएं? कर्मचारी स्कैन नहीं कर पाएगा।")}
        >
          <input type="hidden" name="id" value={emp.id} />
        </ActionForm>
      )}
    </section>
  );

  const advance = (
    <section className="card flex flex-col gap-3">
      <h2 className="font-semibold">{t("Advance balance", "एडवांस बैलेंस")}</h2>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div><div className="muted">{t("Earned this month", "इस महीने की कमाई")}</div><div className="text-lg font-semibold">{formatRs(balance.earned)}</div></div>
        <div><div className="muted">{t("Advance to recover", "वसूली बाकी")}</div><div className="text-lg font-semibold">{formatRs(balance.outstanding)}</div></div>
        <div><div className="muted">{t("Balance", "बैलेंस")}</div><div className={`text-lg font-semibold ${balance.balance < 0 ? "text-red-600" : ""}`}>{formatRs(balance.balance)}</div></div>
      </div>
      {open.length > 0 && (
        <table className="table table-cards">
          <thead><tr><th>{t("Given", "दिया")}</th><th>{t("Amount", "रकम")}</th><th>{t("Recovered", "वसूला")}</th><th>{t("Plan", "योजना")}</th></tr></thead>
          <tbody>
            {open.map((a) => (
              <tr key={a.id}>
                <td data-label={t("Given", "दिया")}>{formatDateKey(dbToDateKey(a.givenOn))}</td>
                <td data-label={t("Amount", "रकम")}>{formatRs(a.amount)}</td>
                <td data-label={t("Recovered", "वसूला")}>{formatRs(a.recovered)}</td>
                <td data-label={t("Plan", "योजना")}>
                  {a.recoveryMonths === 1 ? t("Full", "पूरा") : t(`${a.recoveryMonths} months`, `${a.recoveryMonths} महीने`)} {t("from", "से")} {formatMonth(a.startMonth)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pendingAdvances.length > 0 && (
        <p className="text-sm text-amber-700">
          {t(`${pendingAdvances.length} advance(s) waiting for owner approval.`, `${pendingAdvances.length} एडवांस मालिक की मंज़ूरी के इंतज़ार में।`)}{" "}
          <Link className="underline" href="/approvals">{t("Open approvals", "मंज़ूरी खोलें")}</Link>
        </p>
      )}
      {can(actor, "advances.manage") && emp.active && (
        <details className="rounded-lg border border-[var(--line)] p-3" open={!!sp.advance}>
          <summary className="cursor-pointer font-medium">{t("Give advance", "एडवांस दें")}</summary>
          <ActionForm action={giveAdvance} className="mt-3 grid gap-3 @md:grid-cols-2" submitLabel={t("Save advance", "एडवांस सेव करें")} resetOnSuccess>
            <input type="hidden" name="employeeId" value={emp.id} />
            <div><label className="label">{t("Amount (₹)", "रकम (₹)")}</label><input name="amount" className="input" inputMode="decimal" required /></div>
            <div><label className="label">{t("Date", "तारीख़")}</label><input name="givenOn" type="date" className="input" defaultValue={istDateKey(new Date())} /></div>
            <div>
              <label className="label">{t("Recover over", "वसूली कितने समय में")}</label>
              <select name="recoveryMonths" className="input" defaultValue="1">
                <option value="1">{t("Full, this month end", "पूरा, इस महीने के अंत में")}</option>
                {[2, 3, 4, 6].map((n) => <option key={n} value={n}>{t(`${n} months`, `${n} महीने`)}</option>)}
                <option value="12">{t("12 months (1 year)", "12 महीने (1 साल)")}</option>
              </select>
            </div>
            <div><label className="label">{t("First recovery month", "वसूली का पहला महीना")}</label><input name="startMonth" type="month" className="input" defaultValue={thisMonth} /></div>
            <div className="@md:col-span-2"><label className="label">{t("Note (optional)", "नोट (ज़रूरी नहीं)")}</label><input name="note" className="input" /></div>
          </ActionForm>
        </details>
      )}
    </section>
  );

  const details = manage ? (
    <section className="card">
      <h2 className="mb-3 font-semibold">{t("Details and salary structure", "विवरण और सैलरी ढांचा")}</h2>
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
      <div><span className="muted">{t("Site", "साइट")}:</span> {emp.site.name}</div>
      <div><span className="muted">{t("Mobile", "मोबाइल")}:</span> {emp.phone ?? "—"}</div>
      <div><span className="muted">{t("Pay", "वेतन")}:</span> {emp.wageType === "MONTHLY" ? `${formatRs(emp.monthlyWage)} ${t("/ month", "/ महीना")}` : `${formatRs(emp.dailyWage)} ${t("/ day", "/ दिन")}`}</div>
      <div><span className="muted">PF / ESIC:</span> {emp.pfEnabled ? "PF" : "—"} {emp.esiEnabled ? "ESIC" : ""}</div>
    </section>
  );

  const salary = (
    <section className="card overflow-x-auto">
      <h2 className="mb-3 font-semibold">{t("Salary history", "सैलरी इतिहास")}</h2>
      <table className="table table-cards">
        <thead><tr><th>{t("Month", "महीना")}</th><th>{t("Days", "दिन")}</th><th>{t("Gross", "कुल")}</th><th>{t("Deductions", "कटौती")}</th><th>{t("Net", "हाथ में")}</th><th>{t("Paid", "दिया")}</th><th /></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="card-title font-medium">{formatMonth(l.run.month)} {l.run.status === "DRAFT" && <span className="badge bg-gray-100">{t("draft", "ड्राफ़्ट")}</span>}</td>
              <td data-label={t("Days", "दिन")}>{l.payableDays}</td>
              <td data-label={t("Gross", "कुल")}>{formatRs(l.gross)}</td>
              <td data-label={t("Deductions", "कटौती")}>{formatRs(l.pfEmployee + l.esiEmployee + l.advanceRecovered)}</td>
              <td data-label={t("Net", "हाथ में")} className="font-semibold">{formatRs(l.net)}</td>
              <td data-label={t("Paid", "दिया")}>{l.paidAmount ? formatRs(l.paidAmount) : "—"}</td>
              <td><Link className="text-[var(--brand)] underline" href={`/payslip/${l.id}`}>{t("Payslip", "सैलरी स्लिप")}</Link></td>
            </tr>
          ))}
          {lines.length === 0 && <tr><td colSpan={7} className="muted">{t("No salary prepared yet.", "अभी सैलरी नहीं बनी।")}</td></tr>}
        </tbody>
      </table>
    </section>
  );

  const account = manage ? (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">{t("Web login (view only)", "वेब लॉग इन (सिर्फ़ देखने के लिए)")}</h2>
        <p className="muted">
          {emp.user?.active
            ? t(`On. ${emp.name} can log in at the website with ${emp.phone} and see salary, attendance and advances.`, `चालू। ${emp.name} वेबसाइट पर ${emp.phone} से लॉग इन करके सैलरी, हाज़िरी और एडवांस देख सकते हैं।`)
            : t("Off. Turn on so the employee can view their own salary on the website.", "बंद। चालू करें ताकि कर्मचारी वेबसाइट पर अपनी सैलरी देख सके।")}
        </p>
        <ActionForm action={setEmployeeLogin} submitLabel={emp.user?.active ? t("Turn off web login", "वेब लॉग इन बंद करें") : t("Turn on web login", "वेब लॉग इन चालू करें")} submitClass="btn-secondary">
          <input type="hidden" name="id" value={emp.id} />
          <input type="hidden" name="enable" value={emp.user?.active ? "0" : "1"} />
        </ActionForm>
      </section>
      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">{emp.active ? t("Employee left", "कर्मचारी ने काम छोड़ा") : t("Rejoin", "फिर से जोड़ें")}</h2>
        <ActionForm
          action={setEmployeeLeft}
          submitLabel={emp.active ? t("Mark as left", "छोड़ा हुआ मार्क करें") : t("Make active again", "फिर से चालू करें")}
          submitClass={emp.active ? "btn-danger" : "btn-secondary"}
          confirm={emp.active ? t("Mark as left? Their face will be deleted. Attendance and salary history are kept.", "छोड़ा हुआ मार्क करें? चेहरा हटा दिया जाएगा। हाज़िरी और सैलरी का रिकॉर्ड रहेगा।") : undefined}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={emp.id} />
          {emp.active && (
            <div><label className="label">{t("Last working day", "काम का आख़िरी दिन")}</label><input type="date" name="leftOn" className="input" required defaultValue={istDateKey(new Date())} /></div>
          )}
        </ActionForm>
      </section>
    </div>
  ) : null;

  const tabs = [
    { id: "face", label: t("Face", "चेहरा"), content: face },
    { id: "advance", label: t("Advance", "एडवांस"), content: advance },
    { id: "details", label: t("Details", "विवरण"), content: details },
    { id: "salary", label: t("Salary", "सैलरी"), content: salary },
    ...(account ? [{ id: "account", label: t("Login / Left", "लॉग इन / छोड़ा"), content: account }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/employees" className="muted underline fold:hidden">← {t("Employees", "कर्मचारी")}</Link>
          <h1 className="h1">{emp.name} <span className="text-base font-normal text-[var(--muted)]">{emp.code}</span></h1>
          {!emp.active && <span className="badge bg-gray-200">{t("Left on", "छोड़ा")} {emp.leftOn ? formatDateKey(dbToDateKey(emp.leftOn)) : ""}</span>}
        </div>
        <Link className="btn-secondary" href={`/attendance/register?month=${thisMonth}&employee=${emp.id}`}>{t("Attendance register", "हाज़िरी रजिस्टर")}</Link>
      </div>
      {sp.created && (
        <div className="card border-green-200 bg-green-50 text-sm text-green-800">
          {t("Employee added. Now enroll the face in the Face tab.", "कर्मचारी जुड़ गया। अब चेहरा टैब में चेहरा दर्ज करें।")}
        </div>
      )}
      <Tabs tabs={tabs} initial={sp.advance ? "advance" : undefined} />
    </div>
  );
}
