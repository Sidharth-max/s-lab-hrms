// Shared shape for server action results shown by <ActionForm>.
import { getLang } from "./i18n-server";
import { MESSAGES_HI } from "./messages-hi";

export type ActionResult = { ok?: boolean; error?: string; message?: string; data?: Record<string, unknown> } | null;

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function fail(error: string): ActionResult {
  return { error };
}

async function translate(r: ActionResult): Promise<ActionResult> {
  if (!r || (await getLang()) !== "hi") return r;
  return {
    ...r,
    ...(r.message ? { message: MESSAGES_HI[r.message] ?? r.message } : {}),
    ...(r.error ? { error: MESSAGES_HI[r.error] ?? r.error } : {}),
  };
}

/** Wraps an action so thrown errors become a friendly message (in the user's language) instead of a crash screen. */
export function safe<T extends unknown[]>(fn: (...args: T) => Promise<ActionResult>) {
  return async (...args: T): Promise<ActionResult> => {
    try {
      return await translate(await fn(...args));
    } catch (e) {
      // Let Next.js redirects pass through.
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
      console.error(e);
      return translate({ error: e instanceof Error ? e.message : "Something went wrong" });
    }
  };
}
