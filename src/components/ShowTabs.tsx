import Link from "next/link";
import type { ShowFilter } from "@/lib/show-filter";

/** "Active / All / Archived" tabs. Keeps the page's other search params; default is Active. */
export function ShowTabs({ show, params }: { show: ShowFilter; params: Record<string, string | undefined> }) {
  const href = (v: ShowFilter) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, x]) => x) as [string, string][]);
    if (v === "active") q.delete("show");
    else q.set("show", v);
    const s = q.toString();
    return s ? `?${s}` : "?";
  };
  return (
    <div className="segmented" role="tablist" aria-label="Which employees">
      {(["active", "all", "archived"] as const).map((v) => (
        <Link key={v} href={href(v)} role="tab" aria-selected={show === v} data-active={show === v} scroll={false}>
          {v === "active" ? "Active" : v === "all" ? "All" : "Archived"}
        </Link>
      ))}
    </div>
  );
}
