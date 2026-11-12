"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useT } from "./LangProvider";

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
  const t = useT();
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
        <h1 className="h1">{t("Employees", "कर्मचारी")}</h1>
        {canAdd && <Link href="/employees/new" className="btn-primary">+ {t("Add", "जोड़ें")}</Link>}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search name, code or mobile", "नाम, कोड या मोबाइल खोजें")} className="input" />
      <div className="inline-flex self-start overflow-hidden rounded-lg border border-[var(--line)] text-sm">
        {[false, true].map((left) => (
          <button
            key={String(left)}
            type="button"
            onClick={() => setShowLeft(left)}
            className={`px-3 py-1.5 ${showLeft === left ? "bg-[var(--brand)] text-white" : "bg-white"}`}
          >
            {left ? t("Left", "छोड़ चुके") : t("Working", "काम पर")}
          </button>
        ))}
      </div>
      <ul className="card flex flex-col !p-0">
        {list.map((r) => {
          const active = path === `/employees/${r.id}`;
          return (
            <li key={r.id} className="border-b border-[var(--line)] last:border-0">
              <Link href={`/employees/${r.id}`} className={`flex items-center justify-between gap-2 px-4 py-3 ${active ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name} <span className="muted">{r.code}</span></div>
                  <div className="muted truncate">{r.site} · {r.wage}</div>
                </div>
                {!r.face && r.active && <span className="badge shrink-0 bg-amber-100 text-amber-800">{t("No face", "चेहरा नहीं")}</span>}
              </Link>
            </li>
          );
        })}
        {list.length === 0 && <li className="muted px-4 py-3">{t("No employees found.", "कोई कर्मचारी नहीं मिला।")}</li>}
      </ul>
    </div>
  );
}
