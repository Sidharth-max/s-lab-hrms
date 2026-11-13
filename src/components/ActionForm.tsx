"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/action";
import { toast } from "./Toaster";
import { confirmDialog } from "./controls";

/** A form bound to a server action that shows success/error messages and disables itself while saving. */
export function ActionForm({
  action,
  children,
  className = "",
  submitLabel,
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
    if (r?.ok) ref.current?.removeAttribute("data-dirty");
    if (r?.ok && r.message) toast(r.message, true);
    if (r?.error) toast(r.error, false);
    return r;
  }, null);
  const ref = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      // Typing in the form marks it as having unsaved changes (LeaveGuard warns before leaving).
      onInput={(e) => {
        if ((e.target as HTMLElement).closest("input,textarea,select,[role=listbox],[role=dialog]")) e.currentTarget.setAttribute("data-dirty", "true");
      }}
      onSubmit={(e) => {
        // Ask with our own dialog; when confirmed, submit again with the same button.
        if (!confirm || confirmed.current) {
          confirmed.current = false;
          return;
        }
        e.preventDefault();
        const form = e.currentTarget;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        // "Remove this scanner? It will stop working." -> title "Remove this scanner?", message after it.
        const q = confirm.indexOf("?");
        const title = q > 0 ? confirm.slice(0, q + 1) : confirm;
        const message = q > 0 ? confirm.slice(q + 1).trim() || undefined : undefined;
        void confirmDialog({ title, message, confirmText: submitLabel ?? "OK", danger: submitClass.includes("danger") }).then((ok) => {
          if (!ok) return;
          confirmed.current = true;
          form.requestSubmit(submitter ?? undefined);
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
        {!hideSubmit && (
          <div className="flex items-center gap-3">
            <button type="submit" className={submitClass}>
              {pending ? "Please wait…" : (submitLabel ?? "Save")}
            </button>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            {state?.ok && state.message && <p className="text-sm text-green-700">{state.message}</p>}
          </div>
        )}
      </fieldset>
    </form>
  );
}
