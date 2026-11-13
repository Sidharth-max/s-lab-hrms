import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
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

/** The newer app version, if there is one. Checks on start, when the user returns to the
 * app (unlock, app switch), and every 30 minutes while it stays open. */
export function useAppUpdate() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  useEffect(() => {
    let alive = true;
    const run = () => void checkForUpdate().then((u) => alive && setUpdate(u));
    run();
    // Returning to the app is the most common moment to notice a new build; check then
    // instead of waiting for the 30-minute tick (checkForUpdate's own 10-min cache still applies).
    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active") run();
    });
    const t = setInterval(run, 30 * 60000);
    return () => {
      alive = false;
      appState.remove();
      clearInterval(t);
    };
  }, []);
  return update;
}

/* ───────── In-app download and install ─────────
 * The APK is downloaded inside the app (from hrms.s-lab.dev/download) with a progress bar, then
 * Android's installer opens on it. One shared state, so the pop-up, the scanner button and More
 * all show the same progress. */

export type InstallPhase = "idle" | "downloading" | "installing" | "error";
export interface InstallState {
  phase: InstallPhase;
  progress: number; // 0..1
  error: string | null;
  /** Bumped to ask the update pop-up to show (e.g. after "Later" was pressed earlier). */
  showToken: number;
  /** The update being installed (set by startUpdate). */
  target: AppUpdate | null;
}

let state: InstallState = { phase: "idle", progress: 0, error: null, showToken: 0, target: null };
const listeners = new Set<(s: InstallState) => void>();
function set(patch: Partial<InstallState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function useInstallState() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

/** Shows the update pop-up and starts downloading right away. */
export function startUpdate(update: AppUpdate) {
  set({ showToken: state.showToken + 1, target: update });
  void installUpdate(update);
}

export async function installUpdate(update: AppUpdate) {
  if (state.phase === "downloading" || state.phase === "installing") return;
  if (Platform.OS !== "android") {
    await Linking.openURL(update.url);
    return;
  }
  set({ phase: "downloading", progress: 0, error: null });
  try {
    const FS = await import("expo-file-system/legacy");
    const IntentLauncher = await import("expo-intent-launcher");
    const file = `${FS.cacheDirectory}s-lab-hrms-${update.name}.apk`;
    await FS.deleteAsync(file, { idempotent: true });
    const task = FS.createDownloadResumable(update.url, file, {}, (p) => {
      if (p.totalBytesExpectedToWrite > 0) set({ progress: p.totalBytesWritten / p.totalBytesExpectedToWrite });
    });
    const res = await task.downloadAsync();
    if (!res || res.status !== 200) throw new Error(`Download failed (${res?.status ?? "no answer"}). Try again.`);
    set({ phase: "installing", progress: 1 });
    const uri = await FS.getContentUriAsync(res.uri);
    // FLAG_GRANT_READ_URI_PERMISSION so the installer can read the file.
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", { data: uri, flags: 1, type: "application/vnd.android.package-archive" });
    set({ phase: "idle" });
  } catch (e) {
    set({ phase: "error", error: (e as Error).message || "Download failed. Check the internet and try again." });
  }
}
