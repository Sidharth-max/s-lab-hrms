import { useWindowDimensions } from "react-native";

/**
 * Wide screens (an open foldable, a tablet, a phone held sideways) get a two-panel layout:
 * list on the left, details on the right. A closed foldable or normal phone gets one column.
 */
export function useWide() {
  const { width } = useWindowDimensions();
  return width >= 600;
}

/** Width of the left (list) panel in the two-panel layout. */
export const LIST_PANE = 340;
