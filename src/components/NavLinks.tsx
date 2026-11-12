"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2">
      {links.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-blue-50 text-[var(--brand)]" : "text-[var(--muted)] hover:bg-gray-100"}`}
          >
            {l.label}
            {l.badge ? <span className="badge ml-1 bg-red-600 text-white">{l.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
