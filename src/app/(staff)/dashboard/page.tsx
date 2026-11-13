import Link from "next/link";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ArrowUpRight, BadgeCheck, Camera } from "@/components/icons";
import { requireStaff } from "@/lib/auth";
import { statusBadgeClass } from "@/lib/attendance";
import { buildDashboard } from "@/lib/dashboard";
import { formatRs } from "@/lib/money";
import { formatDateKey } from "@/lib/time";

const SITE_INKS = ["blue", "green", "pink", "violet", "orange", "teal"];

// Today. Same data model as the app's Today screen (src/lib/dashboard.ts), same sections:
// hero numbers, salary to pay, sites, arrivals, and who is in with in / out times.
export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const actor = await requireStaff();
  const sp = await searchParams;
  const d = await buildDashboard(actor);
  const rate = d.counts.total ? d.counts.present / d.counts.total : 0;
  const hours = d.storeHours ? `Open ${d.storeHours.open} – ${d.storeHours.close}${d.storeHours.anyScanFullDay ? " · any scan = full day" : ""}` : "Weekly off today";
  const maxArrivals = Math.max(1, ...d.arrivals.map((a) => a.count));
  const arrivals = d.arrivals.filter((a) => a.hour >= 7 && a.hour <= 21);

  return (
    <div className="flex flex-col gap-4">
      <LiveRefresh kinds={["attendance", "employee", "approval", "salary", "advance"]} />
      {sp.denied && <div className="notice-red">You do not have permission for that page. Ask the owner.</div>}

      <div className="grid gap-4 @3xl:grid-cols-[1.4fr_1fr]">
        <section className="hero rise flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm text-white/80">{formatDateKey(d.date)} · {hours}</p>
              <h1 className="text-2xl font-bold tracking-tight">{d.greeting}</h1>
            </div>
            <span className="chip bg-white/20 text-white"><span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />Live</span>
          </div>
          <div>
            <div className="flex items-end gap-2">
              <span className="text-6xl font-bold tracking-tighter tabular-nums">{d.counts.present}</span>
              <span className="mb-2 text-xl font-semibold text-white/75">/ {d.counts.total} present</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25"><div className="h-2 rounded-full bg-[#4ade80]" style={{ width: `${Math.round(rate * 100)}%` }} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/15 p-3"><div className="text-2xl font-bold tabular-nums">{d.counts.inside}</div><div className="text-xs text-white/85">Inside now</div></div>
            <div className="rounded-2xl bg-white/15 p-3"><div className="text-2xl font-bold tabular-nums">{d.counts.notIn}</div><div className="text-xs text-white/85">Not in yet</div></div>
            <Link href="/approvals" className={`rounded-2xl p-3 ${d.counts.pendingApprovals ? "bg-red-500/35" : "bg-white/15"}`}><div className="text-2xl font-bold tabular-nums">{d.counts.pendingApprovals}</div><div className="text-xs text-white/85">Approvals</div></Link>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {d.payroll && (
            <Link href="/salary" className="card rise flex flex-col gap-1 transition hover:shadow-md">
              <span className="flex items-center justify-between text-sm font-semibold text-[var(--muted)]">Salary to pay <ArrowUpRight size={18} aria-hidden /></span>
              <span className="ink-green text-3xl font-bold tracking-tight tabular-nums">{formatRs(d.payroll.toPay)}</span>
              <span className="muted text-sm">
                {d.payroll.people} {d.payroll.people === 1 ? "person" : "people"} due
                {d.payroll.owed > 0 && <> · <b className="ink-red">{formatRs(d.payroll.owed)}</b> owed by staff</>}
              </span>
            </Link>
          )}
          {d.counts.pendingApprovals > 0 && (
            <Link href="/approvals" className="rise flex items-center gap-3 rounded-[18px] p-3.5 font-semibold" style={{ background: "var(--tint-red)", color: "var(--ink-red)" }}>
              <BadgeCheck size={22} aria-hidden /> {d.counts.pendingApprovals} advance{d.counts.pendingApprovals === 1 ? "" : "s"} waiting for your approval
            </Link>
          )}
          {d.noFace.length > 0 && (
            <div className="rise flex items-start gap-3 rounded-[18px] p-3.5 text-sm font-semibold" style={{ background: "var(--tint-amber)", color: "var(--ink-amber)" }}>
              <Camera size={22} className="shrink-0" aria-hidden />
              <span>
                {d.noFace.length} need a face photo before they can scan:{" "}
                {d.noFace.slice(0, 8).map((e, i) => <span key={e.id}>{i > 0 && ", "}<Link className="underline" href={`/employees/${e.id}`}>{e.name}</Link></span>)}
                {d.noFace.length > 8 && " …"}
              </span>
            </div>
          )}
          {d.sites.length > 0 && (
            <section className="card rise flex flex-col gap-3">
              <div className="flex items-center justify-between"><h2 className="font-bold">Sites</h2><span className="muted text-xs">present / staff</span></div>
              <div className="flex h-2 gap-1">
                {d.sites.map((s, i) => <div key={s.id} className="h-2 rounded-full" style={{ flex: Math.max(0.04, s.total), background: `var(--ink-${SITE_INKS[i % SITE_INKS.length]})` }} />)}
              </div>
              <ul className="flex flex-col gap-2">
                {d.sites.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className="h-8 w-1 rounded-full" style={{ background: `var(--ink-${SITE_INKS[i % SITE_INKS.length]})` }} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{s.name}</span><span className="muted block text-xs">{s.inside} inside · {s.notIn} not in yet</span></span>
                    <span className="text-lg font-bold tabular-nums" style={{ color: `var(--ink-${SITE_INKS[i % SITE_INKS.length]})` }}>{s.present}<span className="text-sm font-normal text-[var(--muted)]"> / {s.total}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {d.rows.some((r) => r.inAt) && (
        <section className="card rise">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Arrivals by hour</h2><span className="ink-blue text-sm font-semibold">{d.rows.filter((r) => r.inAt).length} checked in</span></div>
          <div className="flex h-24 items-end gap-1" role="img" aria-label="Check-ins per hour">
            {arrivals.map((a) => (
              <div key={a.hour} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-[var(--ink-blue)] opacity-80" style={{ height: `${(a.count / maxArrivals) * 72 + (a.count ? 4 : 1)}px` }} title={`${a.count} at ${a.hour}:00`} />
                <span className="text-[10px] text-[var(--muted)]">{((a.hour + 11) % 12) + 1}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card overflow-x-auto !p-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-2"><h2 className="font-bold">Who is in</h2><span className="muted text-sm">{d.counts.present} of {d.counts.total}</span></div>
        <table className="table table-cards">
          <thead>
            <tr><th>Employee</th><th>Site</th><th>Status</th><th>In</th><th>Out</th></tr>
          </thead>
          <tbody className="rise-list">
            {d.rows.map((r) => (
              <tr key={r.id}>
                <td className="card-title"><Link className="font-medium text-[var(--text)] hover:underline" href={`/attendance/${r.id}/${d.date}`}>{r.name}</Link> <span className="muted">{r.code}</span></td>
                <td data-label="Site">{r.site}</td>
                <td data-label="Status">{r.status === "ABSENT" ? <span className="badge badge-neutral">Not in yet</span> : <span className={statusBadgeClass(r.status)}>{r.statusLabel}</span>}{r.manual && <span className="muted"> (manual)</span>}</td>
                <td data-label="In" className={r.inAt ? "ink-teal font-semibold" : ""}>{r.inAt ?? "—"}</td>
                <td data-label="Out" className={r.outAt ? "ink-blue font-semibold" : r.inside ? "ink-teal font-semibold" : ""}>{r.outAt ?? (r.inside ? "inside" : "—")}</td>
              </tr>
            ))}
            {d.rows.length === 0 && <tr><td colSpan={5} className="muted">No employees yet. <Link className="underline" href="/employees/new">Add one</Link></td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
