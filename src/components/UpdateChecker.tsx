"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

/** Inside the Android app only: shows "There is a new update" when GitHub has a newer APK. */
export function UpdateChecker() {
  const [update, setUpdate] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (sessionStorage.getItem("hrms-update-later")) return;
    } catch {}
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const res = await fetch("/api/app-version", { cache: "no-store" });
        const data = await res.json();
        if (data.latest && data.latest.versionCode > Number(info.build)) {
          setUpdate({ name: data.latest.versionName, url: data.apkUrl });
        }
      } catch {
        // No update check when offline.
      }
    })();
  }, []);

  if (!update) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-sm text-center">
        <h2 className="mb-1 text-lg font-bold">There is a new update</h2>
        <p className="muted mb-4">{`Version ${update.name}. Download it and install.`}</p>
        <div className="flex flex-col gap-2">
          <a href={update.url} className="btn-primary">Download update</a>
          <button
            className="btn-secondary"
            onClick={() => {
              try {
                sessionStorage.setItem("hrms-update-later", "1");
              } catch {}
              setUpdate(null);
            }}
          >
            {"Later"}
          </button>
        </div>
      </div>
    </div>
  );
}
