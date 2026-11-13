"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  HandCoins,
  History,
  House,
  IndianRupee,
  Menu,
  Settings,
  Smartphone,
  UserCog,
  Users,
  X,
  type IconType,
} from "@/components/icons";

export const ICONS = {
  home: House,
  employees: Users,
  attendance: CalendarDays,
  salary: IndianRupee,
  advances: HandCoins,
  leave: CalendarCheck,
  approvals: BadgeCheck,
  devices: Smartphone,
  managers: UserCog,
  settings: Settings,
  history: History,
} satisfies Record<string, IconType>;

export type IconName = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
  primary?: boolean;
}

function isActive(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

function Count({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--red)] px-1.5 text-[11px] font-medium text-white">{n}</span>;
}

/** Tabs under the header on tablets, desktops and open foldables. */
export function NavLinks({ links }: { links: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-3 sm:flex">
      {links.map((l) => {
        const Icon = ICONS[l.icon];
        const active = isActive(path, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${
              active ? "border-[var(--text)] font-medium text-[var(--text)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <Icon size={16} aria-hidden />
            {l.label}
            <Count n={l.badge} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar on phones, with a "More" sheet for the rest. */
export function MobileNav({ links, moreLabel, extra }: { links: NavItem[]; moreLabel: string; extra?: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const primary = links.filter((l) => l.primary);
  const rest = links.filter((l) => !l.primary);
  const restBadge = rest.reduce((s, l) => s + (l.badge ?? 0), 0);
  const restActive = rest.some((l) => isActive(path, l.href));

  return (
    <>
      {open && (
        <div className="no-print fixed inset-0 z-40 bg-black/30 sm:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-[var(--line)] bg-[var(--card)] p-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <ul className="flex flex-col">
              {rest.map((l) => {
                const Icon = ICONS[l.icon];
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm ${isActive(path, l.href) ? "bg-[var(--soft)] font-medium" : ""}`}
                    >
                      <Icon size={18} aria-hidden />
                      {l.label}
                      <Count n={l.badge} />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {extra && (
              <div
                className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-3 pt-3"
                onClick={(e) => (e.target as HTMLElement).closest("button,a") && setOpen(false)}
              >
                {extra}
              </div>
            )}
          </div>
        </div>
      )}
      <nav className="no-print fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto grid max-w-md grid-cols-5 rounded-full border border-[var(--line)] bg-[var(--card)] px-2 shadow-[0_8px_24px_rgba(0,0,0,0.14)] sm:hidden">
        {primary.map((l) => {
          const Icon = ICONS[l.icon];
          const active = isActive(path, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`relative flex flex-col items-center gap-1 py-2 text-[11px] ${active ? "font-medium text-[var(--text)]" : "text-[var(--muted)]"}`}
            >
              <Icon size={20} aria-hidden />
              {l.label}
              {l.badge ? <span className="absolute top-1.5 right-1/4 h-2 w-2 rounded-full bg-[var(--red)]" /> : null}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={moreLabel}
          className={`relative flex flex-col items-center gap-1 py-2 text-[11px] ${open || restActive ? "font-medium text-[var(--text)]" : "text-[var(--muted)]"}`}
        >
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          {moreLabel}
          {restBadge ? <span className="absolute top-1.5 right-1/4 h-2 w-2 rounded-full bg-[var(--red)]" /> : null}
        </button>
      </nav>
    </>
  );
}
