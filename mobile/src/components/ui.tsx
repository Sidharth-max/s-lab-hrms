import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, View, type PressableProps, type RefreshControlProps, type TextInputProps, type ViewStyle } from "react-native";
import { Text, TextInput } from "@/components/Text";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { C, isDark, R, shadow, type Ink } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { FLOATING_NAV_SPACE } from "@/lib/layout";
import { CountUp, NOTICE_IN, NOTICE_OUT, PressScale, SkeletonList, SMOOTH_LAYOUT, StaggerScope, useRiseIn } from "@/lib/motion";
import Reanimated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { GradientFill } from "./Viz";
import { BlurFrame, useHeaderPad } from "./BlurFrame";

const SCREEN_IN = FadeIn.duration(220).reduceMotion(ReduceMotion.System);

export function Screen({
  children,
  scroll = true,
  refreshControl,
  padded = true,
  tabs = false,
  bottomSpace = 0,
  footer,
}: {
  children: React.ReactNode;
  /** Sticky bottom bar (use <StickyBar>): pinned to the bottom with the header's frosted blur. */
  footer?: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  padded?: boolean;
  /** A tab screen: on phones leave room at the bottom for the floating navigation bar. */
  tabs?: boolean;
  /** Extra room at the bottom (e.g. for a sticky action bar). */
  bottomSpace?: number;
}) {
  return (
    // With a footer the bar itself covers the bottom inset (the page scrolls under it, blurred).
    <SafeAreaView style={styles.screen} edges={footer ? ["left", "right"] : ["left", "right", "bottom"]}>
      {/* The page starts below the transparent, blurred header and scrolls underneath it. */}
      <StaggerScope>
      <BlurFrame footer={footer}>
        {(pad, bottomPad) => {
          // The page content fades in once it is ready (instead of popping in after the loading placeholder).
          const inner = <Reanimated.View entering={SCREEN_IN} style={[styles.inner, padded && styles.padded, { paddingTop: (padded ? 16 : 0) + pad, paddingBottom: (padded ? 24 : 0) + (tabs ? FLOATING_NAV_SPACE : 0) + bottomSpace + bottomPad }]}>{children}</Reanimated.View>;
          return scroll ? (
            <KeyboardAwareScrollView showsVerticalScrollIndicator={false} bottomOffset={32} keyboardShouldPersistTaps="handled" refreshControl={refreshControl} contentContainerStyle={{ flexGrow: 1 }} scrollIndicatorInsets={{ top: pad, bottom: bottomPad }}>
              {inner}
            </KeyboardAwareScrollView>
          ) : (
            inner
          );
        }}
      </BlurFrame>
      </StaggerScope>
    </SafeAreaView>
  );
}

/** Pull-to-refresh colours: brand spinner on the card colour, with a haptic tick when it starts. */
export function refreshProps(refreshing: boolean, onRefresh: () => void) {
  return {
    refreshing,
    onRefresh: () => {
      haptic.heavy();
      onRefresh();
    },
    colors: [C.brand],
    tintColor: C.brand,
    progressBackgroundColor: C.card,
  };
}

/** Card: rises in when the page opens (one after another), and slides smoothly when things above it change. */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const enter = useRiseIn();
  return <Reanimated.View entering={enter} layout={SMOOTH_LAYOUT} style={[styles.card, style]}>{children}</Reanimated.View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

/** Small uppercase label above a group of cards. */
export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginTop: 4 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.6, color: C.muted, textTransform: "uppercase" }}>{children}</Text>
      {right}
    </View>
  );
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

/** Coloured text (amounts, key labels). Colour goes on the words, not on the background. */
export function InkText({ ink, children, style }: { ink: Ink; children: React.ReactNode; style?: object }) {
  return <Text style={[{ color: C.ink[ink], fontWeight: "600" }, style]}>{children}</Text>;
}

/** Round soft chip with an icon inside, tinted to match an ink. */
export function IconChip({ ink, children, size = 36 }: { ink: Ink; children: React.ReactNode; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: C.tint[ink], alignItems: "center", justifyContent: "center" }}>{children}</View>;
}

/** Title row of a card: tinted icon badge + bold title (Today screen style), optional right side. */
export function SectionHead({ icon, ink, title, right }: { icon?: React.ReactNode; ink?: Ink; title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {icon ? <IconChip ink={ink ?? "violet"} size={34}>{icon}</IconChip> : null}
      <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: C.text, letterSpacing: -0.2 }} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

/** Frosted pill / stat on a gradient hero. */
export function HeroPill({ label, tone }: { label: string; tone?: "alert" | "ok" }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: tone === "alert" ? "rgba(239,68,68,0.34)" : tone === "ok" ? "rgba(74,222,128,0.28)" : "rgba(255,255,255,0.18)" }}>
      {tone ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone === "alert" ? "#fecaca" : "#bbf7d0" }} /> : null}
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function HeroStat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: alert ? "rgba(239,68,68,0.32)" : "rgba(255,255,255,0.16)", borderRadius: 16, paddingVertical: 10, paddingHorizontal: 10, gap: 2 }}>
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
      <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "500" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/**
 * Brand-gradient header card for inner pages (same look as the Today hero): optional avatar or
 * icon, eyebrow, big title, subtitle, frosted pills, a big value and frosted stat tiles.
 */
export function Hero({
  eyebrow, title, subtitle, avatar, icon, pills, value, valueLabel, stats, right, children,
}: {
  eyebrow?: string; title: string; subtitle?: string; avatar?: string; icon?: React.ReactNode;
  pills?: { label: string; tone?: "alert" | "ok" }[]; value?: string; valueLabel?: string;
  stats?: { label: string; value: string; alert?: boolean }[]; right?: React.ReactNode; children?: React.ReactNode;
}) {
  const enter = useRiseIn();
  const initials = avatar ? avatar.trim().split(/\s+/).filter(Boolean).map((p, i, a) => (i === 0 || i === a.length - 1 ? p[0] : "")).join("").toUpperCase().slice(0, 2) : "";
  return (
    <Reanimated.View entering={enter} style={{ borderRadius: 28, padding: 18, gap: 14, overflow: "hidden", ...shadow(2), shadowColor: C.gradient[1] }}>
      <GradientFill />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {avatar ? (
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>{initials || "?"}</Text>
          </View>
        ) : icon ? (
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>{icon}</View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          {eyebrow ? <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "500" }} numberOfLines={1}>{eyebrow}</Text> : null}
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700", letterSpacing: -0.6 }} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {pills?.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{pills.map((p) => <HeroPill key={p.label} {...p} />)}</View> : null}
      {value ? (
        <View style={{ gap: 2 }}>
          {valueLabel ? <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "500" }}>{valueLabel}</Text> : null}
          {/^-?₹[\d,]+$/.test(value) ? (
            // A rupee amount counts up to its value.
            <CountUp value={Number(value.replace(/[^\d-]/g, ""))} format={(n) => `${n < 0 ? "-" : ""}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`} style={{ color: "#fff", fontSize: 34, fontWeight: "700", letterSpacing: -1 }} />
          ) : (
            <Text style={{ color: "#fff", fontSize: 34, fontWeight: "700", letterSpacing: -1, fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
          )}
        </View>
      ) : null}
      {stats?.length ? <View style={{ flexDirection: "row", gap: 8 }}>{stats.map((s) => <HeroStat key={s.label} {...s} />)}</View> : null}
      {children}
    </Reanimated.View>
  );
}

type Variant = "primary" | "secondary" | "danger" | "brand" | "ghost";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  ...rest
}: { title: string; variant?: Variant; loading?: boolean; icon?: React.ReactNode; style?: ViewStyle } & Omit<PressableProps, "style">) {
  // Main actions use the brand gradient of the Today screen; secondary is a plain card button.
  const gradient = variant === "primary" || variant === "brand";
  const bg = { primary: C.gradient[1], danger: C.red, secondary: C.card, brand: C.gradient[1], ghost: "transparent" }[variant];
  const fg = variant === "secondary" || variant === "ghost" ? C.text : "#ffffff";
  const off = disabled || loading;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor: variant === "secondary" ? C.line : bg, opacity: off ? 0.5 : 1 },
        gradient ? [shadow(2), { shadowColor: C.gradient[1], overflow: "hidden" as const }] : null,
        style,
      ]}
      {...rest}
    >
      {gradient ? <GradientFill /> : null}
      {/* Wrapped so the icon always sits above the gradient layer. */}
      {loading ? <ActivityIndicator color={fg} /> : icon ? <View>{icon}</View> : null}
      {/* Shrinks to fit instead of being cut off in narrow places (e.g. Pay / Advance in a Fold's side panel). */}
      <Text style={[styles.buttonText, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{title}</Text>
    </PressScale>
  );
}

export function Field({ label, hint, style, onFocus, onBlur, ...props }: TextInputProps & { label: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={C.placeholder}
        style={[styles.input, focused && { borderColor: C.brand, borderWidth: 1.5 }, style]}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Choice between a few options in a form (Monthly / Daily, AM / PM): pill track, the chosen one raised. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressScale key={o.value} scaleTo={0.96} onPress={() => { if (o.value !== value) haptic.select(); onChange(o.value); }} accessibilityRole="radio" accessibilityState={{ selected: active }} style={[styles.segmentItem, active && styles.segmentActive]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.segmentText, active && { color: C.brandInk }]}>{o.label}</Text>
          </PressScale>
        );
      })}
    </View>
  );
}

/** One choice in a row of options (status, filter): the chosen one in brand colours, like the open tab. */
export function ChoiceChip({ label, selected, onPress, tone }: { label: string; selected: boolean; onPress: () => void; tone?: "red" }) {
  const red = tone === "red" && selected;
  return (
    <PressScale
      scaleTo={0.94}
      onPress={() => { if (!selected) haptic.select(); onPress(); }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: red ? C.ink.red : selected ? C.brand : C.hairline, backgroundColor: red ? C.tint.red : selected ? C.brandSoft : C.card }}
    >
      <Text style={{ fontSize: 14, fontWeight: "600", color: red ? C.ink.red : selected ? C.brandInk : C.muted }}>{label}</Text>
    </PressScale>
  );
}

/** Switch between views on a screen: pill chips, the open one filled. Scrolls if they do not fit. */
export function Tabs<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }} accessibilityRole="tablist" style={{ flexGrow: 0 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressScale
            key={o.value}
            scaleTo={0.94}
            onPress={() => { if (o.value !== value) haptic.select(); onChange(o.value); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: active ? C.brand : C.hairline, backgroundColor: active ? C.brandSoft : C.card }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: active ? C.brandInk : C.muted }}>{o.label}</Text>
          </PressScale>
        );
      })}
    </ScrollView>
  );
}

const AVATAR_INKS: Ink[] = ["violet", "blue", "teal", "pink", "orange", "green"];

/** Round initials avatar, tinted by name so people are easy to tell apart. */
export function Avatar({ name, size = 40, muted }: { name: string; size?: number; muted?: boolean }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const text = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  const ink = AVATAR_INKS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR_INKS.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: muted ? C.soft : C.tint[ink], alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: muted ? C.muted : C.ink[ink], fontWeight: "700", fontSize: Math.round(size * 0.36) }}>{text}</Text>
    </View>
  );
}

/** Our on / off switch (green when on). */
export function Toggle({ value, onValueChange, disabled, label }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  const [x] = useState(() => new Animated.Value(value ? 1 : 0));
  useEffect(() => {
    Animated.timing(x, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [value, x]);
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        haptic.toggle(!value);
        onValueChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      hitSlop={8}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: x.interpolate({ inputRange: [0, 1], outputRange: [isDark ? "#3a3d45" : "#d5d8de", C.green] }) }}>
        <Animated.View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: "#ffffff",
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

/** Round floating action button, bottom right, in the thumb zone (e.g. add employee). */
export function Fab({ icon, label, onPress, lift = 0, extended }: { icon: React.ReactNode; label: string; onPress: () => void; lift?: number; extended?: boolean }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.94} style={[styles.fab, extended && { width: "auto", minWidth: 58, paddingHorizontal: 20, flexDirection: "row", gap: 8 }, lift ? { bottom: 20 + lift } : null]}>
      <GradientFill />
      <View>{icon}</View>
      {extended ? <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 15 }}>{label}</Text> : null}
    </PressScale>
  );
}

export function Badge({ label, tone = "neutral", dot }: { label: string; tone?: "neutral" | "red" | "green" | "amber" | "blue" | "violet"; dot?: boolean }) {
  const map = {
    neutral: { bg: C.track, fg: C.muted },
    red: { bg: C.tint.red, fg: C.ink.red },
    green: { bg: C.tint.green, fg: C.ink.green },
    amber: { bg: C.tint.amber, fg: C.ink.amber },
    blue: { bg: C.tint.blue, fg: C.ink.blue },
    violet: { bg: C.tint.violet, fg: C.ink.violet },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: map.fg }} /> : null}
      <Text style={[styles.badgeText, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

export function Row({ label, value, strong, ink }: { label: string; value: React.ReactNode; strong?: boolean; ink?: Ink }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, ink && { color: C.ink[ink], fontWeight: "500" }]}>{label}</Text>
      {typeof value === "string" || typeof value === "number" ? <Text style={[styles.rowValue, strong && { fontWeight: "700" }, ink && { color: C.ink[ink], fontWeight: "600" }]}>{value}</Text> : value}
    </View>
  );
}

export function Notice({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "red" | "green" }) {
  const map = {
    neutral: { bg: C.card, fg: C.text, border: C.line },
    red: { bg: C.redSoft, fg: C.redInk, border: C.redLine },
    green: { bg: C.greenSoft, fg: C.greenInk, border: C.greenLine },
  }[tone];
  return (
    <Reanimated.View entering={NOTICE_IN} exiting={NOTICE_OUT} layout={SMOOTH_LAYOUT} style={[styles.notice, { backgroundColor: map.bg, borderColor: map.border }]} accessibilityLiveRegion="polite">
      <Text style={{ color: map.fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </Reanimated.View>
  );
}

/** Loading state: card-shaped placeholders instead of a bare spinner. */
export function Loading({ header = true }: { header?: boolean }) {
  const pad = useHeaderPad();
  return <View style={{ paddingTop: pad }}><SkeletonList header={header} /></View>;
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const pad = useHeaderPad();
  return (
    <View style={{ gap: 12, padding: 16, paddingTop: 16 + pad }}>
      <Notice text={message} tone="red" />
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.gradient[1],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadow(3),
    shadowColor: C.gradient[1],
  },
  screen: { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, gap: 14 },
  padded: { padding: 16, paddingTop: 16 },
  card: { backgroundColor: C.card, borderColor: C.hairline, borderWidth: 1, borderRadius: 20, padding: 16, gap: 10, ...shadow(1) },
  h1: { fontSize: 24, fontWeight: "700", color: C.text, letterSpacing: -0.5 },
  h2: { fontSize: 16, fontWeight: "600", color: C.text, letterSpacing: -0.2 },
  muted: { fontSize: 14, color: C.muted, lineHeight: 20 },
  button: { minHeight: 50, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  label: { fontSize: 13, fontWeight: "500", color: C.muted },
  hint: { fontSize: 12, color: C.muted },
  input: { minHeight: 50, borderWidth: 1, borderColor: C.hairline, borderRadius: R.md + 2, paddingHorizontal: 14, fontSize: 16, color: C.text, backgroundColor: C.card },
  segment: { flexDirection: "row", gap: 2, padding: 4, borderRadius: 999, alignSelf: "stretch", backgroundColor: C.track },
  segmentItem: { flex: 1, paddingHorizontal: 4, paddingVertical: 9, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: C.card, ...shadow(1) },
  segmentText: { fontSize: 13, fontWeight: "600", color: C.muted },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6 },
  badgeText: { fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 5 },
  rowLabel: { fontSize: 14, color: C.muted, flexShrink: 1 },
  rowValue: { fontSize: 15, color: C.text, textAlign: "right", flexShrink: 1, fontVariant: ["tabular-nums"] },
  notice: { borderWidth: 1, borderRadius: R.md, padding: 12 },
});

/**
 * Content of a sticky bottom bar (Save, Pay, Advance…). Pass it as <Screen footer={…}>: the Screen pins it
 * to the bottom with the same frosted blur as the header and keeps the page scrollable above it.
 */
export function StickyBar({ children, row }: { children: React.ReactNode; row?: boolean }) {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, gap: row ? 10 : 8, flexDirection: row ? "row" : "column", alignItems: row ? "center" : "stretch" }}>{children}</View>;
}
