import "server-only";
import { NextResponse } from "next/server";
import { getActor } from "./auth";
import { can, type Actor, type Permission } from "./permissions";
import type { ActionResult } from "./action";

// Helpers for the JSON API used by the Android app (routes under /api/m).

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(message: string, status = 400) {
  return json({ ok: false, error: message }, status);
}

/** Runs a handler for a signed-in owner or manager (Bearer token or cookie). */
export async function staff(handler: (actor: Actor) => Promise<Response>, permission?: Permission): Promise<Response> {
  const actor = await getActor();
  if (!actor) return apiError("Not signed in", 401);
  if (actor.role === "EMPLOYEE") return apiError("Not allowed", 403);
  if (permission && !can(actor, permission)) return apiError("You do not have permission for this", 403);
  try {
    return await handler(actor);
  } catch (e) {
    console.error(e);
    return apiError(e instanceof Error ? e.message : "Something went wrong", 500);
  }
}

/** Turns app JSON into the FormData the shared server actions expect. */
export function toForm(body: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(body ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (Array.isArray(value)) value.forEach((v) => form.append(key, String(v)));
    else form.append(key, value === true ? "on" : String(value));
  }
  return form;
}

export function actionResponse(r: ActionResult) {
  if (!r) return json({ ok: true });
  return json(r, r.error ? 400 : 200);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
