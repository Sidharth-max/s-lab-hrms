import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler, tokens } from "./api";

export interface Me {
  user: { id: string; name: string; phone: string; role: "OWNER" | "MANAGER" };
  business: { id: string; name: string };
  permissions: string[];
  sites: { id: string; name: string }[];
  pendingApprovals: number;
}

interface AuthState {
  ready: boolean;
  me: Me | null;
  scannerMode: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  enterScanner: (deviceToken: string) => Promise<void>;
  leaveScanner: () => Promise<void>;
  can: (permission: string) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [scannerMode, setScannerMode] = useState(false);

  const refresh = useCallback(async () => {
    const token = await tokens.getSession();
    if (!token) {
      setMe(null);
      return;
    }
    try {
      setMe(await api.get<Me>("/api/m/me"));
    } catch (e) {
      if ((e as { status?: number }).status === 401) {
        await tokens.clearSession();
        setMe(null);
      }
      // Offline: keep whatever we had.
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void tokens.clearSession();
      setMe(null);
    });
    (async () => {
      setScannerMode(!!(await tokens.getDevice()));
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      me,
      scannerMode,
      refresh,
      signIn: async (token) => {
        await tokens.setSession(token);
        await refresh();
      },
      signOut: async () => {
        try {
          await api.post("/api/m/auth/logout");
        } catch {
          // Ignore: the token is removed from this phone either way.
        }
        await tokens.clearSession();
        setMe(null);
      },
      enterScanner: async (deviceToken) => {
        await tokens.setDevice(deviceToken);
        setScannerMode(true);
      },
      leaveScanner: async () => {
        await tokens.clearDevice();
        setScannerMode(false);
      },
      can: (p) => !!me && (me.user.role === "OWNER" || me.permissions.includes(p)),
    }),
    [ready, me, scannerMode, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
