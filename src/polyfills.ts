// Small polyfills for older browsers (iOS / Safari 14 and 15, older Android WebViews). Each one is
// added only when the browser lacks it. Loaded first, from instrumentation-client.ts, before the
// page starts. Next.js already adds fetch, URL and Object.assign itself.

/* eslint-disable @typescript-eslint/no-explicit-any */
const def = (obj: any, name: string, value: unknown) => {
  if (obj && !(name in obj)) Object.defineProperty(obj, name, { value, writable: true, configurable: true });
};

// form.requestSubmit() (Safari 16): used by forms that submit themselves (OTP box, confirm dialogs).
if (typeof HTMLFormElement !== "undefined") {
  def(HTMLFormElement.prototype, "requestSubmit", function (this: HTMLFormElement, submitter?: HTMLElement | null) {
    if (submitter) {
      submitter.click();
      return;
    }
    const b = document.createElement("button");
    b.type = "submit";
    b.hidden = true;
    this.appendChild(b);
    b.click();
    this.removeChild(b);
  });
}

// Safari 15.4 features
def(Array.prototype, "at", function (this: unknown[], i: number) {
  const n = Math.trunc(i) || 0;
  return this[n < 0 ? this.length + n : n];
});
def(String.prototype, "at", function (this: string, i: number) {
  const n = Math.trunc(i) || 0;
  return this.charAt(n < 0 ? this.length + n : n) || undefined;
});
def(Array.prototype, "findLast", function (this: unknown[], fn: (v: unknown, i: number, a: unknown[]) => boolean, t?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return this[i];
  return undefined;
});
def(Array.prototype, "findLastIndex", function (this: unknown[], fn: (v: unknown, i: number, a: unknown[]) => boolean, t?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return i;
  return -1;
});
def(Object, "hasOwn", (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k));
def(globalThis, "structuredClone", (v: unknown) => (v === undefined ? v : JSON.parse(JSON.stringify(v))));
if (typeof crypto !== "undefined") {
  def(crypto, "randomUUID", () => {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  });
}

// Safari 16+ / 17+ features some libraries use
if (typeof AbortSignal !== "undefined") {
  def(AbortSignal, "timeout", (ms: number) => {
    const c = new AbortController();
    setTimeout(() => c.abort(new DOMException("TimeoutError", "TimeoutError")), ms);
    return c.signal;
  });
}
def(Promise, "withResolvers", function <T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
});
def(Array.prototype, "toSorted", function (this: unknown[], fn?: (a: unknown, b: unknown) => number) {
  return [...this].sort(fn);
});
def(Array.prototype, "toReversed", function (this: unknown[]) {
  return [...this].reverse();
});

export {};
