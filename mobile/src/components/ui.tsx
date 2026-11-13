import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type RefreshControlProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, R } from "@/lib/theme";

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
        <ScrollView keyboardShouldPersistTaps="handled" refreshControl={refreshControl} contentContainerStyle={{ flexGrow: 1 }}>
          {inner}
        </ScrollView>
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
      onPress={onPress}
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

export function Field({ label, hint, style, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#a3a3a3" style={[styles.input, style]} {...props} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segmentItem, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && { color: C.white }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "red" | "green" }) {
  const map = {
    neutral: { bg: C.soft, fg: C.text, border: C.line },
    red: { bg: C.redSoft, fg: C.red, border: "#fecaca" },
    green: { bg: C.greenSoft, fg: C.green, border: "#bbf7d0" },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg, borderColor: map.border }]}>
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
    red: { bg: C.redSoft, fg: "#991b1b", border: "#fecaca" },
    green: { bg: C.greenSoft, fg: "#166534", border: "#bbf7d0" },
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
  screen: { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, gap: 12 },
  padded: { padding: 16 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: R.lg, padding: 16, gap: 10 },
  h1: { fontSize: 22, fontWeight: "700", color: C.text, letterSpacing: -0.3 },
  h2: { fontSize: 16, fontWeight: "600", color: C.text },
  muted: { fontSize: 14, color: C.muted, lineHeight: 20 },
  button: { minHeight: 44, borderRadius: R.md, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { fontSize: 15, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "500", color: C.muted },
  hint: { fontSize: 12, color: C.muted },
  input: { minHeight: 44, borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 12, fontSize: 16, color: C.text, backgroundColor: C.white },
  segment: { flexDirection: "row", borderWidth: 1, borderColor: C.line, borderRadius: R.md, overflow: "hidden", alignSelf: "flex-start" },
  segmentItem: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.white },
  segmentActive: { backgroundColor: C.text },
  segmentText: { fontSize: 14, fontWeight: "500", color: C.text },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  badgeText: { fontSize: 12, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 4 },
  rowLabel: { fontSize: 14, color: C.muted },
  rowValue: { fontSize: 15, color: C.text, textAlign: "right", flexShrink: 1 },
  notice: { borderWidth: 1, borderRadius: R.md, padding: 12 },
});
