import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, View, type PressableProps, type RefreshControlProps, type TextInputProps, type ViewStyle } from "react-native";
import { Text, TextInput } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { C, isDark, R } from "@/lib/theme";
import { haptic } from "@/lib/haptics";

export function Screen({
  children,
  scroll = true,
  refreshControl,
  padded = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  padded?: boolean;
}) {
  const inner = <View style={[styles.inner, padded && styles.padded]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      {scroll ? (
        <KeyboardAwareScrollView
          bottomOffset={32}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {inner}
        </KeyboardAwareScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

type Variant = "primary" | "secondary" | "danger";

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
  const bg = variant === "primary" ? C.text : variant === "danger" ? C.red : C.white;
  const fg = variant === "secondary" ? C.text : C.white;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={(e) => {
        haptic.tap();
        onPress?.(e);
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === "secondary" ? C.line : bg, opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, style, onFocus, onBlur, ...props }: TextInputProps & { label: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={C.placeholder}
        style={[styles.input, focused && { borderColor: C.text }, style]}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Choice between a few options in a form (Monthly / Daily, AM / PM): squared buttons, the chosen one filled. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => { if (o.value !== value) haptic.select(); onChange(o.value); }} accessibilityRole="radio" accessibilityState={{ selected: active }} style={[styles.segmentItem, active && styles.segmentActive]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.segmentText, active && { color: C.white }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Switch between views on a screen: pill chips, the open one filled. Scrolls if they do not fit. */
export function Tabs<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }} accessibilityRole="tablist" style={{ flexGrow: 0 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { if (o.value !== value) haptic.select(); onChange(o.value); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: active ? C.text : pressed ? C.trackPressed : C.track })}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: active ? C.white : C.text }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Round initials avatar. */
export function Avatar({ name, size = 40, muted }: { name: string; size?: number; muted?: boolean }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const text = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: muted ? C.soft : C.head, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: muted ? C.muted : C.white, fontWeight: "700", fontSize: Math.round(size * 0.38) }}>{text}</Text>
    </View>
  );
}

/** Our on / off switch (charcoal track when on, green for the "on" accent). */
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
      <Animated.View
        style={{
          width: 50,
          height: 30,
          borderRadius: 15,
          padding: 3,
          backgroundColor: x.interpolate({ inputRange: [0, 1], outputRange: [isDark ? "#3a3a3a" : "#d4d4d4", C.green] }),
        }}
      >
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

/** Round floating action button, bottom right (e.g. add employee). */
export function Fab({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
    >
      {icon}
    </Pressable>
  );
}

export function Badge({ label, tone = "neutral", dot }: { label: string; tone?: "neutral" | "red" | "green" | "amber"; dot?: boolean }) {
  const map = {
    neutral: { bg: C.track, fg: C.text, border: C.line },
    red: { bg: C.redTint, fg: C.redInk, border: C.redLine },
    green: { bg: C.greenTint, fg: C.greenInk, border: C.greenLine },
    amber: { bg: C.amberTint, fg: C.amberInk, border: C.amberLine },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[styles.badgeText, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

export function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {typeof value === "string" || typeof value === "number" ? <Text style={[styles.rowValue, strong && { fontWeight: "700" }]}>{value}</Text> : value}
    </View>
  );
}

export function Notice({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "red" | "green" }) {
  const map = {
    neutral: { bg: C.white, fg: C.text, border: C.line },
    red: { bg: C.redSoft, fg: C.redInk, border: C.redLine },
    green: { bg: C.greenSoft, fg: C.greenInk, border: C.greenLine },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: map.bg, borderColor: map.border }]}>
      <Text style={{ color: map.fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <ActivityIndicator color={C.text} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ gap: 12, padding: 16 }}>
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
    borderRadius: 30,
    backgroundColor: C.head,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  screen: { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, gap: 14 },
  padded: { padding: 16, paddingTop: 18 },
  card: { backgroundColor: C.card, borderColor: C.hairline, borderWidth: 1, borderRadius: 20, padding: 16, gap: 10, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 0 },
  h1: { fontSize: 22, fontWeight: "700", color: C.text, letterSpacing: -0.3 },
  h2: { fontSize: 16, fontWeight: "600", color: C.text, letterSpacing: -0.2 },
  muted: { fontSize: 14, color: C.muted, lineHeight: 20 },
  button: { minHeight: 48, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { fontSize: 15, fontWeight: "500" },
  label: { fontSize: 13, fontWeight: "500", color: C.muted },
  hint: { fontSize: 12, color: C.muted },
  input: { minHeight: 48, borderWidth: 1, borderColor: C.hairline, borderRadius: 14, paddingHorizontal: 12, fontSize: 16, color: C.text, backgroundColor: C.white },
  // Full width with equal parts, so five tabs still fit on a narrow phone.
  // Pill group: grey pill track, the chosen option a filled charcoal pill.
  segment: { flexDirection: "row", gap: 2, padding: 4, borderRadius: 999, alignSelf: "stretch", backgroundColor: C.track },
  segmentItem: { flex: 1, paddingHorizontal: 4, paddingVertical: 9, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: C.text },
  segmentText: { fontSize: 13, fontWeight: "600", color: C.text },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6 },
  badgeText: { fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 4 },
  rowLabel: { fontSize: 14, color: C.muted },
  rowValue: { fontSize: 15, color: C.text, textAlign: "right", flexShrink: 1, fontVariant: ["tabular-nums"] },
  notice: { borderWidth: 1, borderRadius: R.md, padding: 12 },
});
