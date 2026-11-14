"use client";

import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock } from "@/components/icons";
import { useEffect, useId, useRef, useState } from "react";

// Our own form controls, used instead of the browser's built-in pop-ups (confirm boxes, dropdown
// lists, date / month / time pickers). Each keeps a hidden <input name=…> so server-action forms
// receive the same values as before.

/* ───────────── Confirm dialog ───────────── */

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}
type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void };
const CONFIRM_EVENT = "hrms-confirm";

/** Shows our confirm dialog; resolves true when the user confirms. */
export function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent<ConfirmRequest>(CONFIRM_EVENT, { detail: { ...o, resolve } })));
}

export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const on = (e: Event) => setReq((e as CustomEvent<ConfirmRequest>).detail);
    window.addEventListener(CONFIRM_EVENT, on);
    return () => window.removeEventListener(CONFIRM_EVENT, on);
  }, []);
  useEffect(() => {
    if (!req) return;
    okRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function close(ok: boolean) {
    req?.resolve(ok);
    setReq(null);
  }
  if (!req) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={() => close(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-xl bg-[var(--card)] p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${req.danger ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[var(--soft)]"}`}>
            <CircleAlert size={18} />
          </span>
          <div className="pt-1">
            <h2 id="confirm-title" className="font-semibold">{req.title}</h2>
            {req.message && <p className="muted mt-1 text-sm">{req.message}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => close(false)}>{req.cancelText ?? "Cancel"}</button>
          <button type="button" ref={okRef} className={req.danger ? "btn-danger" : "btn-primary"} onClick={() => close(true)}>{req.confirmText ?? "OK"}</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Popover helper ───────────── */

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const panel = "absolute left-0 top-full z-50 mt-1 rounded-lg border border-[var(--line)] bg-[var(--card)] p-1 shadow-xl";

/* ───────────── Select ───────────── */

export function Select({
  name,
  options,
  defaultValue,
  className = "",
  disabled,
  onChange,
  ariaLabel,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  className?: string;
  disabled?: boolean;
  onChange?: (v: string) => void;
  ariaLabel?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const [active, setActive] = useState(0);
  const { open, setOpen, ref } = usePopover();
  const id = useId();
  const current = options.find((o) => o.value === value);
  const choose = (v: string) => {
    setValue(v);
    setOpen(false);
    onChange?.(v);
  };
  return (
    <div ref={ref} className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} disabled={disabled} />
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={ariaLabel}
        className="input flex items-center justify-between gap-2 text-left disabled:opacity-60"
        onClick={() => {
          setActive(Math.max(0, options.findIndex((o) => o.value === value)));
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setOpen(true);
            return;
          }
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          if (e.key === "Enter") { e.preventDefault(); if (options[active]) choose(options[active].value); }
        }}
      >
        <span className="truncate">{current?.label ?? "Choose"}</span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--muted)] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul id={id} role="listbox" className={`${panel} max-h-64 w-full min-w-40 overflow-auto`}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(o.value); }}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${i === active ? "bg-[var(--soft)]" : ""}`}
            >
              <span>{o.label}</span>
              {o.value === value && <Check size={15} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────── Date / month / time ───────────── */

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function todayKey() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}
function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
const monthText = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` : "Choose month");
const dateText = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : "Choose date");

export function DateInput({
  name,
  defaultValue = "",
  min,
  max,
  className = "",
  disabled,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [shown, setShown] = useState((defaultValue || todayKey()).slice(0, 7));
  const { open, setOpen, ref } = usePopover();
  const [y, m] = shown.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => `${shown}-${pad(i + 1)}`)];
  const today = todayKey();
  const ok = (d: string) => (!min || d >= min) && (!max || d <= max);
  const pick = (d: string) => {
    setValue(d);
    setOpen(false);
    onChange?.(d);
  };
  return (
    <div ref={ref} className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} disabled={disabled} />
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`input flex items-center justify-between gap-2 text-left disabled:opacity-60 ${value ? "" : "text-[var(--placeholder)]"}`}
        onClick={() => {
          setShown((value || today).slice(0, 7));
          setOpen(!open);
        }}
      >
        <span className="truncate">{dateText(value)}</span>
        <CalendarDays size={16} className="shrink-0 text-[var(--muted)]" />
      </button>
      {open && (
        <div role="dialog" aria-label="Choose date" className={`${panel} w-72 p-3`}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="btn-secondary !h-8 !w-8 !p-0" aria-label="Previous month" onClick={() => setShown(shiftMonth(shown, -1))}><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold">{monthText(shown)}</span>
            <button type="button" className="btn-secondary !h-8 !w-8 !p-0" aria-label="Next month" onClick={() => setShown(shiftMonth(shown, 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[var(--muted)]">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) =>
              d ? (
                <button
                  key={i}
                  type="button"
                  disabled={!ok(d)}
                  onClick={() => pick(d)}
                  className={`h-9 rounded-md text-sm transition disabled:text-[var(--faint)] ${d === value ? "bg-[var(--brand)] font-semibold text-[var(--on-brand)]" : d === today ? "border border-[var(--text)] font-semibold" : "hover:bg-[var(--soft)]"}`}
                >
                  {Number(d.slice(8))}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
          <div className="mt-2 flex justify-between">
            <button type="button" className="btn-secondary !h-8" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary !h-8" disabled={!ok(today)} onClick={() => pick(today)}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MonthInput({ name, defaultValue, min, max, className = "", disabled }: { name: string; defaultValue?: string; min?: string; max?: string; className?: string; disabled?: boolean }) {
  const [value, setValue] = useState(defaultValue || todayKey().slice(0, 7));
  const back = !min || shiftMonth(value, -1) >= min;
  const next = !max || shiftMonth(value, 1) <= max;
  return (
    <div className={`input flex items-center justify-between gap-1 !px-1 ${disabled ? "opacity-60" : ""} ${className}`}>
      <input type="hidden" name={name} value={value} disabled={disabled} />
      <button type="button" disabled={disabled || !back} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--soft)] disabled:opacity-30" onClick={() => setValue(shiftMonth(value, -1))}><ChevronLeft size={16} /></button>
      <span className="text-sm">{monthText(value)}</span>
      <button type="button" disabled={disabled || !next} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--soft)] disabled:opacity-30" onClick={() => setValue(shiftMonth(value, 1))}><ChevronRight size={16} /></button>
    </div>
  );
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const time12 = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return "Choose time";
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "am" : "pm"}`;
};

export function TimeInput({ name, defaultValue = "", className = "", disabled }: { name: string; defaultValue?: string; className?: string; disabled?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  const { open, setOpen, ref } = usePopover();
  const [h, mm] = /^\d{1,2}:\d{2}$/.test(value) ? value.split(":").map(Number) : [9, 0];
  const set = (hh: number, m: number) => setValue(`${pad(hh)}:${pad(m)}`);
  const pm = h >= 12;
  const cell = (on: boolean) => `h-8 rounded-md text-sm font-medium border ${on ? "border-[var(--hero-2)] bg-[var(--hero-2)] text-white" : "border-[var(--line)] hover:bg-[var(--soft)]"}`;
  return (
    <div ref={ref} className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} disabled={disabled} />
      <button type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} className={`input flex items-center justify-between gap-2 text-left ${value ? "" : "text-[var(--placeholder)]"}`} onClick={() => setOpen(!open)}>
        <span>{time12(value)}</span>
        <Clock size={16} className="shrink-0 text-[var(--muted)]" />
      </button>
      {open && (
        <div role="dialog" aria-label="Choose time" className={`${panel} w-72 p-3`}>
          <div className="mb-2 grid grid-cols-2 gap-1">
            <button type="button" className={cell(!pm)} onClick={() => set(h % 12, mm)}>AM</button>
            <button type="button" className={cell(pm)} onClick={() => set((h % 12) + 12, mm)}>PM</button>
          </div>
          <p className="label !mb-1">Hour</p>
          <div className="grid grid-cols-6 gap-1">
            {HOURS.map((x) => <button key={x} type="button" className={cell(((h + 11) % 12) + 1 === x)} onClick={() => set((x % 12) + (pm ? 12 : 0), mm)}>{x}</button>)}
          </div>
          <p className="label !mb-1 mt-2">Minute</p>
          <div className="grid grid-cols-6 gap-1">
            {MINS.map((x) => <button key={x} type="button" className={cell(mm === x)} onClick={() => set(h, x)}>{pad(x)}</button>)}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <button type="button" aria-label="One minute earlier" className="btn-secondary !h-8 !w-8 !p-0" onClick={() => { const t = (h * 60 + mm + 1439) % 1440; set(Math.floor(t / 60), t % 60); }}>−</button>
              <span className="w-20 text-center font-semibold">{time12(`${h}:${pad(mm)}`)}</span>
              <button type="button" aria-label="One minute later" className="btn-secondary !h-8 !w-8 !p-0" onClick={() => { const t = (h * 60 + mm + 1) % 1440; set(Math.floor(t / 60), t % 60); }}>+</button>
            </span>
            <button type="button" className="btn-primary !h-8" onClick={() => { if (!value) set(h, mm); setOpen(false); }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
