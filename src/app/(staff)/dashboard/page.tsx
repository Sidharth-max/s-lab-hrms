import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { statusLabel } from "@/lib/attendance";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getT } from "@/lib/i18n-server";
import { employeeScope } from "@/lib/scope";
import { monthAttendance } from "@/lib/services";
import { formatDateKey, formatIstTime, istDateKey } from "@/lib/time";

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const actor = await requireStaff();
  const { t, lang } = await getT();
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
  const pending = await db.approvalRequest.count({ where: { businessId: actor.businessId, status: "PENDING" } });

  return (
    <div className="flex flex-col gap-4">
      {sp.denied && (
        <div className="card border-red-200 bg-red-50 text-sm text-red-800">
          {t("You do not have permission for that page. Ask the owner.", "आपको उस पेज की अनुमति नहीं है। मालिक से पूछें।")}
        </div>
      )}
      <div>
        <h1 className="h1">{t("Today", "आज")} · {formatDateKey(today)}</h1>
        <p className="muted">{t("Hello", "नमस्ते")} {actor.name}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        <Stat label={t("Present", "हाज़िर")} value={present.length} of={employees.length} />
        <Stat label={t("Still inside", "अभी अंदर")} value={inside.length} />
        <Stat label={t("Not came yet", "अभी नहीं आए")} value={notIn.length} />
        <Link href="/approvals"><Stat label={t("Waiting approval", "मंज़ूरी बाकी")} value={pending} warn={pending > 0} /></Link>
      </div>
      {noFace.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 text-sm text-amber-900">
          {t(`${noFace.length} employee(s) need a face photo before they can use the scanner:`, `${noFace.length} कर्मचारी का चेहरा दर्ज नहीं है, वे स्कैनर इस्तेमाल नहीं कर सकते:`)}{" "}
          {noFace.slice(0, 8).map((e, i) => (
            <span key={e.id}>{i > 0 && ", "}<Link className="underline" href={`/employees/${e.id}`}>{e.name}</Link></span>
          ))}
          {noFace.length > 8 && " …"}
        </div>
      )}
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr><th>{t("Employee", "कर्मचारी")}</th><th>{t("Site", "साइट")}</th><th>{t("Status", "स्थिति")}</th><th>{t("In", "आए")}</th><th>{t("Out", "गए")}</th></tr>
          </thead>
          <tbody>
            {rows.map(({ e, d }) => (
              <tr key={e.id}>
                <td className="card-title"><Link className="font-medium text-[var(--brand)]" href={`/attendance/${e.id}/${today}`}>{e.name}</Link> <span className="muted">{e.code}</span></td>
                <td data-label={t("Site", "साइट")}>{e.site.name}</td>
                <td data-label={t("Status", "स्थिति")}>{statusLabel(d.status, lang) || "—"}{d.overridden && <span className="muted"> ({t("manual", "हाथ से")})</span>}</td>
                <td data-label={t("In", "आए")}>{d.inAt ? formatIstTime(d.inAt) : "—"}</td>
                <td data-label={t("Out", "गए")}>{d.outAt ? formatIstTime(d.outAt) : d.missingOut ? <span className="text-amber-700">{t("inside", "अंदर")}</span> : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="muted">{t("No employees yet.", "अभी कोई कर्मचारी नहीं।")} <Link className="underline" href="/employees/new">{t("Add one", "जोड़ें")}</Link></td></tr>
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
