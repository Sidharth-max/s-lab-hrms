import type { ReactNode } from "react";
import { initials } from "./Avatar";

/**
 * Brand-gradient header card for inner pages (same look as the Today hero and the app's Hero):
 * icon or initials, eyebrow, big title, subtitle, frosted pills, a big value and frosted stat tiles.
 */
export function PageHero({
  icon,
  avatar,
  eyebrow,
  title,
  subtitle,
  pills,
  valueLabel,
  value,
  stats,
  actions,
  children,
}: {
  icon?: ReactNode;
  avatar?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  pills?: { label: string; tone?: "ok" | "alert" }[];
  valueLabel?: string;
  value?: ReactNode;
  stats?: { label: string; value: ReactNode; alert?: boolean }[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="hero rise relative overflow-hidden shadow-[0_10px_30px_color-mix(in_srgb,var(--hero-2)_30%,transparent)]">
      <div className="flex items-center gap-3.5">
        {avatar ? (
          <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl font-bold">{initials(avatar)}</span>
        ) : icon ? (
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">{icon}</span>
        ) : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="truncate text-[13px] font-medium text-white/80">{eyebrow}</p> : null}
          <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[28px]">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-white/85">{subtitle}</p> : null}
        </div>
        {actions ? <div className="hidden shrink-0 items-center gap-2 @xl:flex">{actions}</div> : null}
      </div>
      {pills?.length ? (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {pills.map((p) => (
            <span key={p.label} className={`hero-pill ${p.tone === "alert" ? "!bg-red-500/35" : p.tone === "ok" ? "!bg-green-400/30" : ""}`}>
              {p.tone ? <span className={`h-1.5 w-1.5 rounded-full ${p.tone === "alert" ? "bg-red-200" : "bg-green-200"}`} /> : null}
              {p.label}
            </span>
          ))}
        </div>
      ) : null}
      {value !== undefined ? (
        <div className="mt-3.5">
          {valueLabel ? <p className="text-[13px] font-medium text-white/80">{valueLabel}</p> : null}
          <p className="text-[34px] leading-tight font-bold tracking-[-0.03em] tabular-nums">{value}</p>
        </div>
      ) : null}
      {stats?.length ? (
        <div className="mt-3.5 flex gap-2">
          {stats.map((s) => (
            <div key={s.label} className={`hero-stat ${s.alert ? "!bg-red-500/30" : ""}`}>
              <p className="truncate text-lg font-bold tabular-nums">{s.value}</p>
              <p className="truncate text-xs font-medium text-white/85">{s.label}</p>
            </div>
          ))}
        </div>
      ) : null}
      {actions ? <div className="mt-3.5 flex flex-wrap gap-2 @xl:hidden">{actions}</div> : null}
      {children}
    </section>
  );
}

/** Card title: tinted icon badge + bold title, optional right side. */
export function SectionTitle({ icon, ink = "violet", children, right }: { icon?: ReactNode; ink?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="section-title min-w-0">
        {icon ? (
          <span className="icon-badge" style={{ background: `var(--tint-${ink})`, color: `var(--ink-${ink})` }} aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className="truncate">{children}</span>
      </h2>
      {right}
    </div>
  );
}
