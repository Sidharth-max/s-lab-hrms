import { useContext, useRef, type ComponentRef } from "react";
import { View, type ViewStyle } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { useNavigation } from "expo-router";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { C, isDark } from "@/lib/theme";

/**
 * Frosted status bar + header. Stack screens use a transparent header (root _layout); the page
 * scrolls underneath it and this strip blurs what passes below. On Android the blur needs the
 * content inside a BlurTargetView that the BlurView points at (expo-blur); older Android versions
 * that cannot blur get the same strip as a translucent tint, so the title always stays readable.
 */

/** Height of the transparent header (status bar included) on a stack screen; 0 under the tabs. */
export function useHeaderPad() {
  const height = (useContext(HeaderHeightContext) as number | undefined) ?? 0;
  const navigation = useNavigation();
  // Embedded panels and tab screens sit under the tabs' own (opaque) header: no extra space.
  return navigation.getState()?.type === "stack" ? height : 0;
}

/** Blur strip of the given height at the top of the screen, blurring `target`. */
export function BlurStrip({ height, target, visible = true }: { height: number; target: React.RefObject<ComponentRef<typeof View> | null>; visible?: boolean }) {
  if (!height) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height, opacity: visible ? 1 : 0 }}>
      <BlurView
        blurTarget={target}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={60}
        tint={isDark ? "dark" : "light"}
        style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: C.hairline }}
      />
    </View>
  );
}

/**
 * Wraps a screen: children get the top padding to start below the header, and the header area
 * shows the blur of whatever scrolls under it.
 */
export function BlurFrame({ children, style }: { children: (pad: number) => React.ReactNode; style?: ViewStyle }) {
  const pad = useHeaderPad();
  const target = useRef<ComponentRef<typeof View>>(null);
  return (
    <View style={[{ flex: 1 }, style]}>
      <BlurTargetView ref={target} style={{ flex: 1 }}>
        {children(pad)}
      </BlurTargetView>
      <BlurStrip height={pad} target={target} />
    </View>
  );
}
