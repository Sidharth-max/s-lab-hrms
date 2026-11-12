import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// Client for the server's app API (/api/m). The login token and scanner token are kept in secure storage.

export const API_URL: string = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? "https://hrms.s-lab.dev";

const TOKEN_KEY = "hrms.session";
const DEVICE_KEY = "hrms.device";

export const tokens = {
  getSession: () => SecureStore.getItemAsync(TOKEN_KEY),
  setSession: (t: string) => SecureStore.setItemAsync(TOKEN_KEY, t),
  clearSession: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  getDevice: () => SecureStore.getItemAsync(DEVICE_KEY),
  setDevice: (t: string) => SecureStore.setItemAsync(DEVICE_KEY, t),
  clearDevice: () => SecureStore.deleteItemAsync(DEVICE_KEY),
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
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError("No internet connection. Check the network and try again.", 0);
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
