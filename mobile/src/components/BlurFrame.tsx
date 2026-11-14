import { createContext, useContext, useEffect, useRef, useState, type ComponentRef } from "react";
import { View, type ViewStyle } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { HeaderHeightContext } from "expo-router/react-navigation";
import Animated from "react-native-reanimated";
import { BAR_IN } from "@/lib/motion";
import { C, isDark } from "@/lib/theme";

/**
 * Frosted status bar + header. Stack screens use a transparent header (root _layout); the page
 * scrolls underneath it and this strip blurs what passes below. On Android the blur needs the
 * content inside a BlurTargetView that the BlurView points at (expo-blur); older Android versions
 * that cannot blur get the same strip as a translucent tint, so the title always stays readable.
 */

/** True inside a BlurFrame whose scroll area already starts below the header. */
const Covered = createContext(false);

/**
 * Height of the transparent header (status bar included) above this screen: stack pages and the
 * Employees / Attendance / Salary tabs (both navigators use transparent headers). 0 for screens
 * without a header (Today, login, scanner) and inside a frame that already made room for it.
 */
export function useHeaderPad() {
  const height = (useContext(HeaderHeightContext) as number | undefined) ?? 0;
  return useContext(Covered) ? 0 : height;
}

/**
 * Until the page has slid in, the frosted areas show a soft solid tint instead of the live blur: a
 * blur view mounted during the page transition can draw black for a few frames on Android (it
 * captures the page before the page has drawn). The blur takes over once the page is in place.
 */
function useBlurReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 380);
    return () => clearTimeout(t);
  }, []);
  return ready;
}

/** The frosted fill: live blur once ready, a tint of the page colour before that. */
function Frost({ target, ready, edge }: { target: React.RefObject<ComponentRef<typeof View> | null>; ready: boolean; edge: "top" | "bottom" }) {
  const border = edge === "top" ? { borderBottomWidth: 1, borderBottomColor: C.hairline } : { borderTopWidth: 1, borderTopColor: C.hairline };
  if (!ready) return <View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? "rgba(11,12,16,0.94)" : "rgba(243,244,247,0.94)" }, border]} />;
  return (
    <BlurView
      blurTarget={target}
      blurMethod="dimezisBlurViewSdk31Plus"
      intensity={60}
      tint={isDark ? "dark" : "light"}
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, border]}
      pointerEvents="none"
    />
  );
}

/** Blur strip of the given height at the top of the screen, blurring `target`. */
export function BlurStrip({ height, target, visible = true }: { height: number; target: React.RefObject<ComponentRef<typeof View> | null>; visible?: boolean }) {
  const ready = useBlurReady();
  if (!height) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height, opacity: visible ? 1 : 0 }}>
      <Frost target={target} ready={ready} edge="top" />
    </View>
  );
}

/**
 * Wraps one scroll area (a page, or one panel of the two-panel layout): children get the top padding to
 * start below the header, and the header area shows the blur of whatever scrolls under it.
 * `footer` (sticky Save / Pay / Advance bar) is pinned to the bottom with the same frosted blur as the
 * header; children get its height as the second argument so the page can scroll clear of it.
 */
export function BlurFrame({ children, style, footer }: { children: (pad: number, bottomPad: number) => React.ReactNode; style?: ViewStyle; footer?: React.ReactNode }) {
  const pad = useHeaderPad();
  const target = useRef<ComponentRef<typeof View>>(null);
  const [footerH, setFooterH] = useState(0);
  const ready = useBlurReady();
  return (
    <View style={[{ flex: 1 }, style]}>
      <BlurTargetView ref={target} style={{ flex: 1 }}>
        <Covered.Provider value={pad > 0}>{children(pad, footer ? footerH : 0)}</Covered.Provider>
      </BlurTargetView>
      <BlurStrip height={pad} target={target} />
      {footer ? (
        <Animated.View entering={BAR_IN} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }} onLayout={(e) => setFooterH(Math.round(e.nativeEvent.layout.height))}>
          <Frost target={target} ready={ready} edge="bottom" />
          {footer}
        </Animated.View>
      ) : null}
    </View>
  );
}
