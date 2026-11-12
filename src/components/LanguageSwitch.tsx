"use client";

import { useTransition } from "react";
import { setLanguage } from "@/app/actions/lang";
import { useLang } from "./LangProvider";

/** className controls visibility/placement (e.g. "hidden sm:inline-flex"); default is inline-flex. */
export function LanguageSwitch({ className = "inline-flex" }: { className?: string }) {
  const lang = useLang();
  const [pending, start] = useTransition();
  return (
    <div className={`${className} overflow-hidden rounded-lg border border-[var(--line)] text-sm`} role="group" aria-label="Language / भाषा">
      {(
        [
          ["en", "English"],
          ["hi", "हिंदी"],
        ] as const
      ).map(([code, label]) => (
        <button
          key={code}
          type="button"
          disabled={pending}
          aria-pressed={lang === code}
          onClick={() => start(() => setLanguage(code))}
          className={`px-3 py-1.5 font-medium ${lang === code ? "bg-[var(--brand)] text-white" : "bg-white text-[var(--text)] hover:bg-gray-50"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
