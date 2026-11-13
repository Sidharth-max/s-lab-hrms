"use client";

import { useState } from "react";

/**
 * Narrow space (phone, or one half of a foldable): tab bar, one section at a time.
 * Wide space: every section shown together in a two-column grid. Based on the container width.
 */
export function Tabs({
  tabs,
  initial,
}: {
  tabs: { id: string; label: string; content: React.ReactNode; wide?: boolean }[];
  initial?: string;
}) {
  const [active, setActive] = useState(initial && tabs.some((t) => t.id === initial) ? initial : tabs[0]?.id);
  return (
    <div className="@container">
      <div className="no-print mb-4 flex gap-2 overflow-x-auto pb-1 @4xl:hidden" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${active === t.id ? "bg-[var(--brand)] text-white" : "bg-[#f1f1f1] text-[var(--text)] hover:bg-[#e8e8e8]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 @4xl:grid-cols-2">
        {tabs.map((t) => (
          <div key={t.id} role="tabpanel" className={`${active === t.id ? "block" : "hidden"} min-w-0 @4xl:block ${t.wide ? "@4xl:col-span-2" : ""}`}>
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}
