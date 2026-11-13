"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DateInput } from "./controls";

/**
 * Date picker that opens the chosen day straight away (no "Go" button): picking a date updates
 * the URL (?date=…), which re-renders the page with that day's data. Other query values are kept.
 */
export function DateJump({ value, max, param = "date", today }: { value: string; max?: string; param?: string; today?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <div className={`w-44 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <DateInput
        key={value}
        name={param}
        defaultValue={value}
        max={max}
        onChange={(v) => {
          const q = new URLSearchParams(sp.toString());
          if (!v || v === today) q.delete(param);
          else q.set(param, v);
          start(() => router.push(`${path}${q.size ? `?${q}` : ""}`));
        }}
      />
    </div>
  );
}
