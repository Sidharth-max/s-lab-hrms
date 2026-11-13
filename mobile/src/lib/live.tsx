import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import EventSource from "react-native-sse";
import { API_URL, tokens } from "./api";
import { useAuth } from "./auth";

// One live connection to the server for the whole app. Screens subscribe to the kinds of change
// they show ("attendance", "employee", ...) and reload when one arrives.

type Listener = (kind: string) => void;

interface Live {
  connected: boolean;
  on: (fn: Listener) => () => void;
}

const Ctx = createContext<Live>({ connected: false, on: () => () => {} });

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { me } = useAuth();
  const listeners = useRef(new Set<Listener>());
  const [connected, setConnected] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Only while signed in and the app is on screen (saves battery and data).
    if (!me || !appActive) return;
    let es: EventSource<"change" | "ready"> | null = null;
    let cancelled = false;
    (async () => {
      const token = await tokens.getSession();
      if (!token || cancelled) return;
      es = new EventSource<"change" | "ready">(`${API_URL}/api/m/events`, {
        headers: { Authorization: `Bearer ${token}` },
        pollingInterval: 3000, // reconnect delay after a drop
        timeoutBeforeConnection: 0,
      });
      es.addEventListener("ready", () => setConnected(true));
      es.addEventListener("error", () => setConnected(false));
      es.addEventListener("close", () => setConnected(false));
      es.addEventListener("change", (e) => {
        try {
          const { kind } = JSON.parse(e.data ?? "{}") as { kind?: string };
          if (kind) listeners.current.forEach((fn) => fn(kind));
        } catch {
          // ignore malformed events
        }
      });
    })();
    return () => {
      cancelled = true;
      es?.removeAllEventListeners();
      es?.close();
      setConnected(false);
    };
  }, [me, appActive]);

  const on = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);
  const value = useMemo(() => ({ connected, on }), [connected, on]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive() {
  return useContext(Ctx);
}

/** Calls `onChange` (debounced) when one of `kinds` changes on the server. */
export function useLiveReload(kinds: string[] | undefined, onChange: () => void) {
  const { on } = useLive();
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  const key = kinds?.join(",") ?? "";
  useEffect(() => {
    if (!key) return;
    const wanted = new Set(key.split(","));
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = on((kind) => {
      if (!wanted.has(kind)) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => cb.current(), 300);
    });
    return () => {
      off();
      if (t) clearTimeout(t);
    };
  }, [key, on]);
}

/** Keeps the signed-in profile (e.g. the approvals badge) fresh. */
export function LiveProfileRefresher() {
  const { refresh } = useAuth();
  useLiveReload(["approval", "advance", "settings"], () => void refresh());
  return null;
}
