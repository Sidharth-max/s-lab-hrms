"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  primary?: boolean;
}

function isActive(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

/** Top tabs on tablets/desktop/open foldables. */
export function NavLinks({ links }: { links: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-2 pb-2 sm:flex">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${isActive(path, l.href) ? "bg-blue-50 text-[var(--brand)]" : "text-[var(--muted)] hover:bg-gray-100"}`}
        >
          {l.label}
          {l.badge ? <span className="badge ml-1 bg-red-600 text-white">{l.badge}</span> : null}
        </Link>
      ))}
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
        <div className="no-print fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-2">
              {rest.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-3 text-center text-sm ${isActive(path, l.href) ? "bg-blue-50 text-[var(--brand)]" : "bg-gray-50"}`}
                >
                  <span className="text-xl" aria-hidden>{l.icon}</span>
                  <span>{l.label}{l.badge ? <span className="badge ml-1 bg-red-600 text-white">{l.badge}</span> : null}</span>
                </Link>
              ))}
            </div>
            {extra && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2" onClick={(e) => (e.target as HTMLElement).closest("button,a") && setOpen(false)}>
                {extra}
              </div>
            )}
          </div>
        </div>
      )}
      <nav className="no-print fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[var(--line)] bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        {primary.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive(path, l.href) ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}
          >
            <span className="text-lg leading-none" aria-hidden>{l.icon}</span>
            {l.label}
            {l.badge ? <span className="badge absolute top-1 right-3 bg-red-600 text-white">{l.badge}</span> : null}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${open || restActive ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}
        >
          <span className="text-lg leading-none" aria-hidden>☰</span>
          {moreLabel}
          {restBadge ? <span className="badge absolute top-1 right-3 bg-red-600 text-white">{restBadge}</span> : null}
        </button>
      </nav>
    </>
  );
}
