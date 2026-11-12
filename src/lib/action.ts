// Shared shape for server action results shown by <ActionForm>.

export type ActionResult = { ok?: boolean; error?: string; message?: string; data?: Record<string, unknown> } | null;

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function fail(error: string): ActionResult {
  return { error };
}

/** Wraps an action so thrown errors become a friendly message instead of a crash screen. */
export function safe<T extends unknown[]>(fn: (...args: T) => Promise<ActionResult>) {
  return async (...args: T): Promise<ActionResult> => {
    try {
      return await fn(...args);
    } catch (e) {
      // Let Next.js redirects pass through.
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
      console.error(e);
      return { error: e instanceof Error ? e.message : "Something went wrong" };
    }
  };
}
