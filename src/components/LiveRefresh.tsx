"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the page's data when something relevant changes on the server (no manual reload). */
export function LiveRefresh({ kinds }: { kinds: string[] }) {
  const router = useRouter();
  const key = kinds.join(",");
  useEffect(() => {
    const wanted = new Set(key.split(","));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const es = new EventSource("/api/live");
    es.addEventListener("change", (ev) => {
      try {
        const { kind } = JSON.parse((ev as MessageEvent).data) as { kind: string };
        if (!wanted.has(kind)) return;
      } catch {
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      es.close();
    };
  }, [key, router]);
  return null;
}
