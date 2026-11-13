import { useSyncExternalStore } from "react";

/**
 * Shared open/close state for the "More" bottom sheet. The More tab in the
 * bottom bar opens it (like the website's mobile nav); any menu row closes it.
 * A module-level store keeps this trivial: no context, one subscriber (the
 * layout that renders the sheet) plus readers of the open flag (tab icon).
 */

let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openMore() {
  if (!open) {
    open = true;
    emit();
  }
}

export function closeMore() {
  if (open) {
    open = false;
    emit();
  }
}

export function useMoreOpen() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => open,
  );
}
