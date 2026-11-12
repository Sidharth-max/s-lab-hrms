"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
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
  const [showLeft, setShowLeft] = useState(false);
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
        {canAdd && <Link href="/employees/new" className="btn-primary"><Plus size={16} strokeWidth={2} aria-hidden />Add</Link>}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={"Search name, code or mobile"} className="input" />
      <div className="inline-flex self-start overflow-hidden rounded-lg border border-[var(--line)] text-sm">
        {[false, true].map((left) => (
          <button
            key={String(left)}
            type="button"
            onClick={() => setShowLeft(left)}
            className={`px-3 py-1.5 ${showLeft === left ? "bg-[var(--brand)] text-white" : "bg-white"}`}
          >
            {left ? "Left" : "Working"}
          </button>
        ))}
      </div>
      <ul className="card flex flex-col !p-0">
        {list.map((r) => {
          const active = path === `/employees/${r.id}`;
          return (
            <li key={r.id} className="border-b border-[var(--line)] last:border-0">
              <Link href={`/employees/${r.id}`} className={`flex items-center justify-between gap-2 px-4 py-3 ${active ? "bg-[var(--soft)]" : "hover:bg-gray-50"}`}>
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name} <span className="muted">{r.code}</span></div>
                  <div className="muted truncate">{r.site} · {r.wage}</div>
                </div>
                {!r.face && r.active && <span className="badge badge-neutral shrink-0">No face</span>}
              </Link>
            </li>
          );
        })}
        {list.length === 0 && <li className="muted px-4 py-3">No employees found.</li>}
      </ul>
    </div>
  );
}
