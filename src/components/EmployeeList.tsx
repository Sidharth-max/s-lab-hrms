"use client";

import Link from "next/link";
import { ChevronRight, Plus, Search } from "@/components/icons";
import { Avatar } from "./Avatar";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export interface EmployeeRow {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  site: string;
  wage: string;
  active: boolean;
  face: boolean;
}

export function EmployeeList({ rows, canAdd }: { rows: EmployeeRow[]; canAdd: boolean }) {
  const path = usePathname();
  const [q, setQ] = useState("");
  const [showLeft, setShowLeft] = useState(false); // true = archived
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.active !== showLeft &&
        (!s || r.name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s) || (r.phone ?? "").includes(s)),
    );
  }, [rows, q, showLeft]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h1">Employees</h1>
        {canAdd && <Link href="/employees/new" className="btn-primary"><Plus size={16} aria-hidden />Add</Link>}
      </div>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={"Search name, code or mobile"} className="input !pl-9" />
      </div>
      <div className="segmented" role="tablist">
        {[false, true].map((archived) => (
          <button key={String(archived)} type="button" role="tab" aria-selected={showLeft === archived} onClick={() => setShowLeft(archived)} data-active={showLeft === archived}>
            {archived ? "Archived" : "Active"}
            <span className="ml-1.5 text-[var(--muted)]">{rows.filter((r) => r.active !== archived).length}</span>
          </button>
        ))}
      </div>
      <ul className="card flex flex-col !p-1">
        {list.map((r) => {
          const active = path === `/employees/${r.id}` || path.startsWith(`/employees/${r.id}/`);
          return (
            <li key={r.id}>
              <Link href={`/employees/${r.id}`} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition ${active ? "bg-[var(--soft)]" : "hover:bg-[var(--soft)]"}`}>
                <Avatar name={r.name} size={34} muted={!r.active} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name} <span className="font-normal text-[var(--muted)]">{r.code}</span></div>
                  <div className="truncate text-xs text-[var(--muted)]">{r.site} · {r.wage}</div>
                </div>
                {!r.face && r.active && <span className="badge badge-red shrink-0">No face</span>}
                <ChevronRight size={16} className="shrink-0 text-[var(--muted)]" aria-hidden />
              </Link>
            </li>
          );
        })}
        {list.length === 0 && <li className="muted px-3 py-3">{showLeft ? "No archived employees." : "No employees found."}</li>}
      </ul>
    </div>
  );
}
