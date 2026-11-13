import "server-only";
import { EventEmitter } from "node:events";

// In-process live-update hub. Every change publishes "<businessId>" with a short kind;
// open app screens and web pages listening on /api/m/events (or /api/live) reload their data.
// The production server runs one app process, so an in-memory emitter is enough.

export interface LiveEvent {
  kind: string; // e.g. "attendance", "employee", "advance", "approval", "payroll", "settings", "device"
  at: number;
}

const g = globalThis as unknown as { hrmsEvents?: EventEmitter };
const bus = (g.hrmsEvents ??= new EventEmitter());
bus.setMaxListeners(0);

export function publish(businessId: string, kind: string) {
  // Slight delay so a change made inside a database transaction is committed before screens re-read it.
  setTimeout(() => bus.emit(businessId, { kind, at: Date.now() } satisfies LiveEvent), 250);
}

export function subscribe(businessId: string, fn: (e: LiveEvent) => void): () => void {
  bus.on(businessId, fn);
  return () => bus.off(businessId, fn);
}

/** Maps a history-log action ("attendance.punch.add") to a live-update kind ("attendance"). */
export function kindOf(action: string): string {
  const head = action.split(".")[0];
  if (head === "face" || head === "employee") return "employee";
  if (head === "leave") return "attendance";
  if (head === "site" || head === "holiday" || head === "settings" || head === "manager") return "settings";
  return head;
}

/** Server-Sent Events response for one business. */
export function eventStream(businessId: string, signal: AbortSignal): Response {
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(enc.encode(text));
        } catch {
          cleanup();
        }
      };
      send(`retry: 3000\nevent: ready\ndata: {}\n\n`);
      const off = subscribe(businessId, (e) => send(`event: change\ndata: ${JSON.stringify(e)}\n\n`));
      // Keep the connection open through proxies (Cloudflare closes idle streams).
      const ping = setInterval(() => send(`: ping\n\n`), 20000);
      cleanup = () => {
        clearInterval(ping);
        off();
        try {
          controller.close();
        } catch {}
      };
      signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
