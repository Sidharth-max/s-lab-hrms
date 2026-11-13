import { useWindowDimensions } from "react-native";

/**
 * Truly wide screens (an open foldable, a tablet) get a two-panel layout:
 * list on the left, details on the right. Phones — even large or landscape ones —
 * stay on the single-column layout with the floating bottom bar. The old 600px
 * threshold fired on many normal phones and broke the whole UI.
 */
export function useWide() {
  const { width } = useWindowDimensions();
  return width >= 900;
}

/** Width of the left (list) panel in the two-panel layout. */
export const LIST_PANE = 340;

/** Space to leave at the bottom of tab screens on phones, where the navigation bar floats over the content. */
export const FLOATING_NAV_SPACE = 96;
