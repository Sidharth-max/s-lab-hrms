import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Client for the server's app API (/api/m). The login token and scanner token are kept in secure storage.

export const API_URL: string = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? "https://hrms.s-lab.dev";

const TOKEN_KEY = "hrms.session";
const DEVICE_KEY = "hrms.device";

// Phones use the encrypted secure store. The browser build (used only for testing) falls back to localStorage.
const store =
  Platform.OS === "web"
    ? {
        get: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
        set: async (k: string, v: string) => globalThis.localStorage?.setItem(k, v),
        del: async (k: string) => globalThis.localStorage?.removeItem(k),
      }
    : { get: SecureStore.getItemAsync, set: SecureStore.setItemAsync, del: SecureStore.deleteItemAsync };

export const tokens = {
  getSession: () => store.get(TOKEN_KEY),
  setSession: (t: string) => store.set(TOKEN_KEY, t),
  clearSession: () => store.del(TOKEN_KEY),
  getDevice: () => store.get(DEVICE_KEY),
  setDevice: (t: string) => store.set(DEVICE_KEY, t),
  clearDevice: () => store.del(DEVICE_KEY),
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Called when the server says the login is no longer valid. Set by the auth provider. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown, opts: { device?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.device) {
    const d = await tokens.getDevice();
    if (d) headers["X-Device-Token"] = d;
  } else {
    const t = await tokens.getSession();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const send = async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      return await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  };
  let res: Response;
  try {
    res = await send();
  } catch {
    // One quiet retry: mobile networks often drop the first request after the app wakes up.
    try {
      await new Promise((r) => setTimeout(r, 1000));
      res = await send();
    } catch {
      throw new ApiError(`Could not reach the server (${API_URL.replace(/^https?:\/\//, "")}). Check the internet and try again.`, 0);
    }
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (res.status === 401 && !opts.device && !path.startsWith("/api/m/auth/")) onUnauthorized();
  if (!res.ok) throw new ApiError(data.error ?? data.message ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  /** Runs a shared server action (same rules as the website). */
  action: (name: string, body: Record<string, unknown>) =>
    request<{ ok?: boolean; message?: string; error?: string; data?: Record<string, unknown> }>("POST", `/api/m/action/${name}`, body),
  scanner: {
    config: () => request<ScanConfig>("GET", "/api/scan", undefined, { device: true }),
    scan: (body: Record<string, unknown>) => request<ScanResult>("POST", "/api/scan", body, { device: true }),
  },
};

export interface ScanConfig {
  registered: boolean;
  device: { name: string; site: string; business: string };
  mode: "mock" | "aws";
  liveness: boolean;
  testEmployees: { id: string; name: string; code: string }[];
}

export interface ScanResult {
  ok: boolean;
  message?: string;
  duplicate?: boolean;
  type?: "IN" | "OUT";
  name?: string;
  code?: string;
  time?: string;
  speech?: string;
  title?: string;
}
