import { useEffect, useRef, useState } from "react";
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Text } from "@/components/Text";
import { C } from "./theme";
import { haptic } from "./haptics";

// Micro-animations. Every one of them follows the phone's "Remove animations" / reduce motion
// setting: reanimated's useReducedMotion() and ReduceMotion.System turn them into instant changes.

export { useReducedMotion };

const SPRING = { damping: 18, stiffness: 320, mass: 0.6, reduceMotion: ReduceMotion.System };

/** Pressable that shrinks slightly while held and gives a light haptic tick. */
export function PressScale({
  children,
  style,
  scaleTo = 0.97,
  haptics = true,
  onPress,
  ...rest
}: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; scaleTo?: number; haptics?: boolean; children: React.ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        s.set(withSpring(scaleTo, SPRING));
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.set(withSpring(1, SPRING));
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptics) haptic.tap();
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, a]}>{children}</Animated.View>
    </Pressable>
  );
}

/** List rows slide up and fade in, one after another (first few only, so long lists stay fast). */
export function enterAt(i: number) {
  return FadeInDown.duration(260)
    .delay(Math.min(i, 8) * 35)
    .easing(Easing.out(Easing.cubic))
    .reduceMotion(ReduceMotion.System);
}

/** A number that counts up to its value (amounts and counts on dashboards). */
export function CountUp({ value, format = (n) => String(Math.round(n)), style, duration = 650 }: { value: number; format?: (n: number) => string; style?: object; duration?: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      from.current = value;
      return;
    }
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(a + (value - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce, duration]);
  return <Text style={[{ fontVariant: ["tabular-nums"] }, style]}>{format(reduce ? value : shown)}</Text>;
}

/** Grey placeholder block that gently pulses while data loads. */
export function Skeleton({ w = "100%", h = 14, r = 8, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: ViewStyle }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(0.55);
  useEffect(() => {
    if (!reduce) o.set(withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [o, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: C.track }, a, style]} />;
}

/** Card-shaped loading placeholder used instead of a spinner on list screens. */
export function SkeletonList({ rows = 6, header = true }: { rows?: number; header?: boolean }) {
  return (
    <View style={{ padding: 16, gap: 12 }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {header ? (
        <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: C.hairline }}>
          <Skeleton w="40%" h={12} />
          <Skeleton w="60%" h={28} r={10} />
          <Skeleton w="80%" h={12} />
        </View>
      ) : null}
      <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 4, borderWidth: 1, borderColor: C.hairline }}>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
            <Skeleton w={40} h={40} r={20} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton w={`${55 + ((i * 13) % 30)}%`} h={13} />
              <Skeleton w={`${30 + ((i * 7) % 25)}%`} h={11} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Check mark that pops in (success states). */
export function SuccessPop({ children }: { children: React.ReactNode }) {
  const s = useSharedValue(0.4);
  const o = useSharedValue(0);
  useEffect(() => {
    s.set(withSpring(1, { damping: 10, stiffness: 220, reduceMotion: ReduceMotion.System }));
    o.set(withTiming(1, { duration: 180, reduceMotion: ReduceMotion.System }));
    haptic.success();
  }, [s, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

export { Animated, FadeInDown, ReduceMotion };
