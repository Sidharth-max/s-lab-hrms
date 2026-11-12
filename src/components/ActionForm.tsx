"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/action";
import { toast } from "./Toaster";

/** A form bound to a server action that shows success/error messages and disables itself while saving. */
export function ActionForm({
  action,
  children,
  className = "",
  submitLabel = "Save",
  submitClass = "btn-primary",
  confirm,
  resetOnSuccess = false,
  hideSubmit = false,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  children?: React.ReactNode;
  className?: string;
  submitLabel?: string;
  submitClass?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  hideSubmit?: boolean;
}) {
  // Toast as soon as the server answers, before the page refreshes and maybe removes this form.
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, form: FormData) => {
    const r = await action(prev, form);
    if (r?.ok && r.message) toast(r.message, true);
    if (r?.error) toast(r.error, false);
    return r;
  }, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
        {!hideSubmit && (
          <div className="flex items-center gap-3">
            <button type="submit" className={submitClass}>
              {pending ? "Please wait…" : submitLabel}
            </button>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            {state?.ok && state.message && <p className="text-sm text-green-700">{state.message}</p>}
          </div>
        )}
      </fieldset>
    </form>
  );
}
