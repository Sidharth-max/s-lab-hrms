"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { confirmDialog } from "./controls";

// Warns before leaving a page that has a form with unsaved typing.
// Forms mark themselves with data-dirty="true" (see ActionForm).

function hasUnsaved() {
  return !!document.querySelector('form[data-dirty="true"]');
}

export function LeaveGuard() {
  const router = useRouter();
  useEffect(() => {
    // Closing the tab, reloading or typing a new address: the browser's own prompt is the only option here.
    const unload = (e: BeforeUnloadEvent) => {
      if (!hasUnsaved()) return;
      e.preventDefault();
    };
    // Clicking a link inside the site: ask with our dialog first.
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== location.origin || a.hasAttribute("download")) return;
      if (a.closest('form[data-dirty="true"]') || !hasUnsaved()) return;
      e.preventDefault();
      e.stopPropagation();
      void confirmDialog({ title: "Discard changes?", message: "You have changes that are not saved yet. If you leave now they are lost.", confirmText: "Discard", cancelText: "Keep editing", danger: true }).then((ok) => {
        if (!ok) return;
        document.querySelectorAll('form[data-dirty="true"]').forEach((f) => f.removeAttribute("data-dirty"));
        router.push(a.pathname + a.search + a.hash);
      });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [router]);
  return null;
}
