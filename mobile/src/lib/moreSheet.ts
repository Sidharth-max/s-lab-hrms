import { useSyncExternalStore } from "react";

/**
 * Open / closed state of the two bottom overlays that belong to the navigation bar:
 * the "More" menu sheet and the Search sheet. A module-level store: any screen can open them,
 * the tab layout renders them. Both close with Back, a tap outside or a drag down.
 */
type Overlay = "more" | "search" | null;
let open: Overlay = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openOverlay(o: Exclude<Overlay, null>) {
  if (open !== o) {
    open = o;
    emit();
  }
}

export function closeOverlay() {
  if (open) {
    open = null;
    emit();
  }
}

export const openMore = () => openOverlay("more");
export const openSearch = () => openOverlay("search");
export const closeMore = closeOverlay;

export function useOverlay() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => open,
  );
}
