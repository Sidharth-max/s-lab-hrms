import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { API_URL } from "./api";

export interface AppUpdate {
  name: string;
  url: string;
}

/** Version of this installed app (set by the GitHub build). */
export const installedVersion = {
  code: Number((Constants.expoConfig?.extra as { versionCode?: number } | undefined)?.versionCode ?? 0),
  name: Constants.expoConfig?.version ?? "",
};

let pending: Promise<AppUpdate | null> | null = null;
let checkedAt = 0;

/** Asks the server for the newest APK. Cached for 10 minutes. */
export function checkForUpdate(force = false): Promise<AppUpdate | null> {
  if (!pending || force || Date.now() - checkedAt > 10 * 60000) {
    checkedAt = Date.now();
    pending = fetch(`${API_URL}/api/app-version`, { headers: { "Cache-Control": "no-cache" } })
      .then((r) => r.json())
      .then((d: { latest?: { versionCode: number; versionName: string } | null; downloadUrl?: string; apkUrl?: string }) => {
        // The website serves the APK itself (hrms.s-lab.dev/download), so phones do not depend on GitHub.
        const url = d.downloadUrl ?? d.apkUrl;
        return d.latest && url && d.latest.versionCode > installedVersion.code ? { name: d.latest.versionName, url } : null;
      })
      .catch(() => {
        pending = null;
        return null;
      });
  }
  return pending;
}

/** The newer app version, if there is one. Checks again every 30 minutes. */
export function useAppUpdate() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  useEffect(() => {
    let alive = true;
    const run = () => void checkForUpdate().then((u) => alive && setUpdate(u));
    run();
    const t = setInterval(run, 30 * 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return update;
}
