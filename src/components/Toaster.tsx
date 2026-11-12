"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; text: string; ok: boolean };
const EVENT = "hrms-toast";
let seq = 0;

/** Show a short message at the bottom of the screen. It stays even if the form that sent it disappears. */
export function toast(text: string, ok = true) {
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: { id: ++seq, text, ok } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<Toast>).detail;
      setItems((list) => [...list.slice(-2), t]);
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), 4000);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${t.ok ? "bg-green-700" : "bg-red-700"}`} role="status">
          {t.text}
        </div>
      ))}
    </div>
  );
}
