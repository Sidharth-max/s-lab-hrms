import { useWindowDimensions } from "react-native";

/**
 * Adaptive layout, following Google's window size classes and Samsung's Galaxy Z Fold guidance.
 *
 * Width:  compact < 600 dp · medium 600–839 dp · expanded ≥ 840 dp
 * Height: compact < 480 dp · medium 480–899 dp · expanded ≥ 900 dp
 * (developer.android.com, "Use window size classes")
 *
 * The classes are computed from the WINDOW (useWindowDimensions), not the device, so split screen,
 * pop-up windows and folding / unfolding all re-layout automatically.
 *
 * Why the old check was wrong: it used `width >= 900`.
 *  - An open Galaxy Z Fold in portrait is about 670–720 dp wide (medium width), so it never reached
 *    900 and always got the phone layout: "the open foldable view does not work".
 *  - A bar phone turned to landscape is about 800–930 dp wide, so many phones crossed 900 and got
 *    the two-pane foldable layout. But its height is compact (< 480 dp), where Google says two-pane
 *    layouts are not practical. Width alone (or orientation) cannot tell these apart; the height
 *    class can.
 *
 * Rules used here:
 *  - Two panes (list + detail): width medium or wider AND height not compact. Covers the open Fold
 *    in both orientations, tablets and large split-screen windows; never a phone in landscape.
 *  - Navigation rail instead of the bottom bar: the same condition (Samsung: "use a navigation rail
 *    on Z Fold in portrait"; Material: rail for medium and expanded).
 *  - Pane ratio: Samsung recommends 50:50 on foldables (the fold sits in the middle), 42:58 for
 *    600–959 dp and 38:62 from 960 dp. A near-square window (aspect < 1.35) is treated as an open
 *    foldable inner screen and split 50:50 so neither pane sits on the crease.
 */
export type WidthClass = "compact" | "medium" | "expanded";
export type HeightClass = "compact" | "medium" | "expanded";

export function widthClass(w: number): WidthClass {
  return w < 600 ? "compact" : w < 840 ? "medium" : "expanded";
}

export function heightClass(h: number): HeightClass {
  return h < 480 ? "compact" : h < 900 ? "medium" : "expanded";
}

export interface WindowLayout {
  width: number;
  height: number;
  widthClass: WidthClass;
  heightClass: HeightClass;
  /** List and detail side by side. */
  twoPane: boolean;
  /** Navigation rail on the side instead of the floating bottom bar. */
  rail: boolean;
  /** Near-square large window: an open book-style foldable. */
  foldLike: boolean;
  /** Fraction of the content width for the first (list) pane. */
  listFraction: number;
}

export function computeLayout(width: number, height: number): WindowLayout {
  const wc = widthClass(width);
  const hc = heightClass(height);
  const twoPane = wc !== "compact" && hc !== "compact";
  const aspect = Math.max(width, height) / Math.min(width, height);
  const foldLike = twoPane && aspect < 1.35;
  // List pane kept narrow so the detail pane gets the room (Pay / Advance and forms need the width).
  const listFraction = foldLike ? 0.38 : width < 960 ? 0.36 : 0.32;
  return { width, height, widthClass: wc, heightClass: hc, twoPane, rail: twoPane, foldLike, listFraction };
}

export function useWindowLayout(): WindowLayout {
  const { width, height } = useWindowDimensions();
  return computeLayout(width, height);
}

/** Kept for the screens: true when list and detail sit side by side. */
export function useWide() {
  return useWindowLayout().twoPane;
}

/** Width of the navigation rail. */
export const RAIL_WIDTH = 64;

/** Space to leave at the bottom of tab screens on phones, where the navigation bar floats over the content. */
export const FLOATING_NAV_SPACE = 104;
