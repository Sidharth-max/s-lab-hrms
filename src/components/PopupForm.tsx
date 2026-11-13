"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "./icons";

/**
 * A button that opens its form in a pop-up (native <dialog>: focus trap, Esc / Back close it).
 * On phones it slides up from the bottom like a sheet; on wider screens it is a centred dialog.
 * Closes by itself after the form inside saves successfully (ActionForm's "action:success" event).
 * Used for "Schedule leave", which used to expand a form at the top of a long page without
 * scrolling to it, so it looked like nothing happened.
 */
export function PopupForm({ label, title, buttonClass = "btn-primary", children }: { label: React.ReactNode; title: string; buttonClass?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>{label}</button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        className="m-0 mt-auto w-full max-w-none rounded-t-[28px] border-0 bg-[var(--card)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-[24px]"
      >
        <div
          className="rise flex max-h-[88dvh] flex-col gap-3 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          ref={(el) => {
            if (!el) return;
            const onOk = () => setOpen(false);
            el.addEventListener("action:success", onOk);
            return () => el.removeEventListener("action:success", onOk);
          }}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-[var(--line)] sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--track)]"><X size={18} aria-hidden /></button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
