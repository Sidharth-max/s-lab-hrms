import Link from "next/link";
import { CalendarCheck, HandCoins, IndianRupee, Settings, Smartphone, UserCog, Users, type IconType } from "@/components/icons";
import { requireOwner } from "@/lib/auth";
import { describeHistory, type HistoryArea } from "@/lib/audit-text";
import { db } from "@/lib/db";
import { formatDateKey, istDateKey } from "@/lib/time";

const AREAS: { key: HistoryArea | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "employee", label: "Employees" },
  { key: "attendance", label: "Attendance" },
  { key: "advance", label: "Advances" },
  { key: "salary", label: "Salary" },
  { key: "team", label: "Managers" },
  { key: "settings", label: "Settings" },
  { key: "device", label: "Scanners" },
];

const ICON: Record<HistoryArea, IconType> = {
  employee: Users,
  attendance: CalendarCheck,
  advance: HandCoins,
  salary: IndianRupee,
  team: UserCog,
  settings: Settings,
  device: Smartphone,
};

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const actor = await requireOwner();
  const sp = await searchParams;
  const area = AREAS.some((a) => a.key === sp.area) ? (sp.area as HistoryArea | "all") : "all";
  const logs = await db.auditLog.findMany({ where: { businessId: actor.businessId }, orderBy: { createdAt: "desc" }, take: 300 });
  const items = (await describeHistory(actor.businessId, logs)).filter((i) => area === "all" || i.area === area);

  // Group by day (India time).
  const days = new Map<string, typeof items>();
  for (const i of items) {
    const key = istDateKey(new Date(i.at));
    days.set(key, [...(days.get(key) ?? []), i]);
  }
  const today = istDateKey(new Date());

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="h1">History</h1>
        <p className="muted">Every change made by the owner and managers (latest 300).</p>
      </div>
      <div className="segmented overflow-x-auto">
        {AREAS.map((a) => (
          <Link
            key={a.key}
            href={a.key === "all" ? "/audit" : `/audit?area=${a.key}`}
            data-active={area === a.key}
            className="whitespace-nowrap"
          >
            {a.label}
          </Link>
        ))}
      </div>
      {items.length === 0 && <div className="card muted">Nothing here yet.</div>}
      {[...days.entries()].map(([day, list]) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-[var(--muted)]">{day === today ? `Today · ${formatDateKey(day)}` : formatDateKey(day)}</h2>
          <ul className="card divide-y divide-[var(--line)] !p-0">
            {list.map((i) => {
              const Icon = ICON[i.area];
              return (
                <li key={i.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--line)]">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.title}</p>
                    {i.detail && <p className="muted text-sm">{i.detail}</p>}
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <div>{new Date(i.at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}</div>
                    <div className="muted">{i.by}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
