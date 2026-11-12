import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/attendance";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { employeeScope } from "@/lib/scope";
import { monthAttendance } from "@/lib/services";
import { formatDateKey, formatIstTime, istDateKey, weekday } from "@/lib/time";
import { parseDayRules } from "@/lib/day-rules";

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const actor = await requireStaff();
  const sp = await searchParams;
  const today = istDateKey(new Date());
  const employees = await db.employee.findMany({
    where: employeeScope(actor, { active: true }),
    include: { site: true },
    orderBy: { name: "asc" },
  });
  const { days } = await monthAttendance(actor.businessId, today.slice(0, 7), employees);
  const rows = employees.map((e) => ({ e, d: days.get(e.id)!.find((x) => x.date === today)! }));
  const present = rows.filter((r) => r.d.status === "PRESENT" || r.d.status === "HALF_DAY");
  const inside = present.filter((r) => r.d.missingOut);
  const notIn = rows.filter((r) => r.d.status === "ABSENT");
  // Faces enrolled in test mode must be enrolled again once real AWS face recognition is switched on.
  const noFace = employees.filter((e) => !e.faceId || (env.faceProvider === "aws" && e.faceId.startsWith("mock-")));
  const [pending, business] = await Promise.all([
    db.approvalRequest.count({ where: { businessId: actor.businessId, status: "PENDING" } }),
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
  ]);
  const todayRule = parseDayRules(business.dayRules)[weekday(today)];
  const offToday = business.weeklyOffDays.includes(weekday(today));

  return (
    <div className="flex flex-col gap-4">
      {sp.denied && (
        <div className="notice-red">
          {"You do not have permission for that page. Ask the owner."}
        </div>
      )}
      <div>
        <h1 className="h1">{"Today"} · {formatDateKey(today)}</h1>
        <p className="muted">
          {"Hello"} {actor.name} ·{" "}
          {offToday
            ? "Weekly off today"
            : `${"Store hours"} ${todayRule.open} – ${todayRule.close}${todayRule.anyScanFullDay ? " · any scan = full day" : ""}`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        <Stat label={"Present"} value={present.length} of={employees.length} />
        <Stat label={"Still inside"} value={inside.length} />
        <Stat label={"Not came yet"} value={notIn.length} />
        <Link href="/approvals"><Stat label={"Waiting approval"} value={pending} warn={pending > 0} /></Link>
      </div>
      {noFace.length > 0 && (
        <div className="notice-red">
          {`${noFace.length} employee(s) need a face photo before they can use the scanner:`}{" "}
          {noFace.slice(0, 8).map((e, i) => (
            <span key={e.id}>{i > 0 && ", "}<Link className="underline" href={`/employees/${e.id}`}>{e.name}</Link></span>
          ))}
          {noFace.length > 8 && " …"}
        </div>
      )}
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr><th>Employee</th><th>Site</th><th>Status</th><th>In</th><th>Out</th></tr>
          </thead>
          <tbody>
            {rows.map(({ e, d }) => (
              <tr key={e.id}>
                <td className="card-title"><Link className="font-medium text-[var(--text)] hover:underline" href={`/attendance/${e.id}/${today}`}>{e.name}</Link> <span className="muted">{e.code}</span></td>
                <td data-label={"Site"}>{e.site.name}</td>
                <td data-label={"Status"}>{STATUS_LABEL[d.status] || "—"}{d.overridden && <span className="muted"> ({"manual"})</span>}</td>
                <td data-label={"In"}>{d.inAt ? formatIstTime(d.inAt) : "—"}</td>
                <td data-label={"Out"}>{d.outAt ? formatIstTime(d.outAt) : d.missingOut ? <span className="text-[var(--red)]">inside</span> : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="muted">{"No employees yet."} <Link className="underline" href="/employees/new">Add one</Link></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, of, warn }: { label: string; value: number; of?: number; warn?: boolean }) {
  return (
    <div className={`card ${warn ? "border-red-200 bg-red-50" : ""}`}>
      <div className="muted">{label}</div>
      <div className="text-2xl font-bold">{value}{of != null && <span className="text-base font-normal text-[var(--muted)]"> / {of}</span>}</div>
    </div>
  );
}
