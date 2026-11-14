"use client";

import { usePathname } from "next/navigation";

/**
 * List + detail. Phone: one at a time (list on the base route, detail on sub-routes).
 * Open foldable / tablet: both side by side, each pane on its own screen half.
 */
export function SplitView({ base, list, children }: { base: string; list: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const atBase = path === base;
  return (
    <div className="split grid gap-4 fold:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)]">
      <aside className={`${atBase ? "block" : "hidden"} min-w-0 fold:block fold:max-h-[calc(100dvh-8rem)] fold:overflow-y-auto`}>{list}</aside>
      <section className={`${atBase ? "hidden" : "block"} cq min-w-0 fold:block`}>{children}</section>
    </div>
  );
}
