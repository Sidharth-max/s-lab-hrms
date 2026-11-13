"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  HandCoins,
  History,
  House,
  IndianRupee,
  Menu,
  Search,
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

/** Text ink for each page tile in the More sheet (same colours as the app). */
const TILE_INK: Partial<Record<IconName, string>> = { advances: "orange", leave: "teal", approvals: "red", devices: "blue", managers: "pink", settings: "green", history: "violet" };

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
              active ? "border-[var(--accent)] font-semibold text-[var(--text)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
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

/**
 * Opens an overlay as a history entry, so the phone's Back button / back swipe closes the overlay
 * instead of leaving the page (the same rule as the app: Back never drops you somewhere else).
 */
function useBackClosable(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    history.pushState({ overlay: true }, "");
    const onPop = () => close();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (history.state?.overlay) history.back();
    };
  }, [open, close]);
}

interface Person { id: string; name: string; code: string; phone: string | null; site: string; active: boolean }

/** Search sheet: the search box sits at the bottom (thumb zone), results fill upwards. */
function SearchSheet({ onClose, links }: { onClose: () => void; links: NavItem[] }) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/m/employees", { headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((d: { employees?: Person[] }) => alive && setPeople(d.employees ?? []))
      .catch(() => alive && setPeople([]));
    return () => { alive = false; };
  }, []);
  const s = q.trim().toLowerCase();
  const found = (people ?? []).filter((e) => !s || e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s) || (e.phone ?? "").includes(s)).slice(0, s ? 30 : 8);
  const pages = s ? links.filter((l) => l.label.toLowerCase().includes(s)) : [];
  const onSalary = path.startsWith("/salary");
  const go = (href: string) => { onClose(); setTimeout(() => router.push(href), 0); };
  return (
    <div className="no-print fixed inset-0 z-[60] flex flex-col justify-end bg-black/40 sm:hidden" onClick={onClose}>
      <div className="rise flex max-h-[85dvh] flex-col rounded-t-[28px] bg-[var(--card)] pb-[calc(0.75rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-[var(--line)]" />
        <div className="flex items-center justify-between px-5 pt-2">
          <h2 className="text-lg font-bold">{onSalary ? "Find someone to pay" : "Search"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--track)]"><X size={18} aria-hidden /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {pages.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2 pb-2">
              {pages.map((p) => <button key={p.href} type="button" onClick={() => go(p.href)} className="chip bg-[var(--accent-soft)] !text-sm text-[var(--accent-ink)]">{p.label}</button>)}
            </div>
          )}
          <div className="px-2 pb-1 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">People{s ? ` · ${found.length}` : ""}</div>
          {people === null && <p className="muted px-2 py-3">Loading…</p>}
          {people && found.length === 0 && <p className="muted px-2 py-3">No one matches “{q}”.</p>}
          <ul className="rise-list">
            {found.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => go(`/employees/${e.id}${onSalary ? "?tab=ledger" : ""}`)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-[var(--soft)]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--tint-violet)] text-sm font-bold text-[var(--ink-violet)]">{e.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.name} <span className="font-normal text-[var(--muted)]">{e.code}</span></span>
                    <span className="block truncate text-xs text-[var(--muted)]">{e.site}{e.active ? "" : " · archived"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-4 pt-2">
          <label className="flex items-center gap-2 rounded-full border-[1.5px] border-[var(--accent)] bg-[var(--card)] px-4">
            <Search size={20} className="text-[var(--accent-ink)]" aria-hidden />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, code or mobile…" className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none" aria-label="Search" enterKeyHint="search" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search"><X size={18} className="text-[var(--muted)]" aria-hidden /></button>}
          </label>
        </div>
      </div>
    </div>
  );
}

/**
 * Bottom navigation on phones (reference: the app). A floating pill bar in the thumb zone: the open
 * page grows into a tinted pill with its label, the others are icons. The round Search button sits
 * next to it. "More" opens a sheet for the other pages. Back closes an open sheet.
 */
export function MobileNav({ links, moreLabel, extra }: { links: NavItem[]; moreLabel: string; extra?: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState<"more" | "search" | null>(null);
  const close = useCallback(() => setOpen(null), []);
  useBackClosable(open !== null, close);
  const primary = links.filter((l) => l.primary);
  const rest = links.filter((l) => !l.primary);
  const restBadge = rest.reduce((sum, l) => sum + (l.badge ?? 0), 0);
  const restActive = rest.some((l) => isActive(path, l.href));

  return (
    <>
      {open === "search" && <SearchSheet onClose={close} links={links} />}
      {open === "more" && (
        <div className="no-print fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={close}>
          <div
            className="rise absolute inset-x-0 bottom-0 rounded-t-[28px] bg-[var(--card)] p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={moreLabel}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--line)]" />
            <ul className="rise-list grid grid-cols-3 gap-2.5">
              {rest.map((l) => {
                const Icon = ICONS[l.icon];
                const ink = TILE_INK[l.icon] ?? "violet";
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={close}
                      className={`flex min-h-24 flex-col justify-between gap-2 rounded-[20px] p-3.5 text-sm font-semibold transition active:scale-[0.97] ${isActive(path, l.href) ? "bg-[var(--accent-soft)]" : "bg-[var(--soft)]"}`}
                    >
                      <span className="flex items-start justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `var(--tint-${ink})`, color: `var(--ink-${ink})` }}><Icon size={20} aria-hidden /></span>
                        <Count n={l.badge} />
                      </span>
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {extra && (
              <div
                className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-1 pt-3"
                onClick={(e) => (e.target as HTMLElement).closest("button,a") && close()}
              >
                {extra}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="no-print fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-2.5 sm:hidden">
        <nav className="flex h-16 flex-1 items-center justify-between rounded-full border border-[var(--line)] bg-[var(--card)] px-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.16)]">
          {primary.map((l) => {
            const Icon = ICONS[l.icon];
            const active = isActive(path, l.href) && open !== "more";
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                aria-label={l.label}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-[52px] items-center justify-center gap-2 rounded-full transition-all duration-200 ${active ? "grow bg-[var(--accent-soft)] px-4 text-[var(--accent-ink)]" : "w-[52px] text-[var(--muted)]"}`}
              >
                <Icon size={23} aria-hidden />
                {active && <span className="rise text-sm font-semibold">{l.label}</span>}
                {l.badge ? <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[var(--red)]" /> : null}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen((o) => (o === "more" ? null : "more"))}
            aria-label={moreLabel}
            aria-expanded={open === "more"}
            className={`relative flex h-[52px] w-[52px] items-center justify-center rounded-full ${open === "more" || restActive ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--muted)]"}`}
          >
            {open === "more" ? <X size={23} aria-hidden /> : <Menu size={23} aria-hidden />}
            {restBadge ? <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[var(--red)]" /> : null}
          </button>
        </nav>
        <button
          type="button"
          onClick={() => setOpen("search")}
          aria-label="Search"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--on-brand)] shadow-[0_10px_30px_rgba(15,23,42,0.22)] transition active:scale-95"
        >
          <Search size={25} aria-hidden />
        </button>
      </div>
    </>
  );
}
