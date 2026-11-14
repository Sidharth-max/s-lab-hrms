"use client";

import { useEffect } from "react";

/** Registers the service worker (installable app, offline page). Production only: in development it
 *  would cache the dev server's changing files. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
