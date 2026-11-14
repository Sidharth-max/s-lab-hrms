import { useId, useState } from "react";
import { View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { Text } from "./Text";
import { C, type Ink } from "@/lib/theme";

/**
 * Brand gradient behind hero areas (react-native-svg, no extra native module).
 * The SVG is drawn at the measured size of its box, not "100%": on Android a percentage-sized SVG
 * kept its first size after unfolding / rotating the Fold, so the purple stopped short of the
 * card's right edge. onLayout fires on every size change and the gradient is redrawn to fit.
 */
export function GradientFill({ colors = C.gradient, style, angle = "diagonal" }: { colors?: readonly string[]; style?: ViewStyle; angle?: "diagonal" | "vertical" }) {
  const id = useId().replace(/:/g, "");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!size || Math.round(width) !== Math.round(size.w) || Math.round(height) !== Math.round(size.h)) setSize({ w: width, h: height });
      }}
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors[Math.floor(colors.length / 2)] }, style]}
    >
      {size ? (
        <Svg key={`${Math.round(size.w)}x${Math.round(size.h)}`} width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2={angle === "diagonal" ? "1" : "0"} y2="1">
              {colors.map((c, i) => <Stop key={i} offset={String(i / Math.max(1, colors.length - 1))} stopColor={c} />)}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Dotted half-ring gauge (reference: the "Spending" gauge in image 5). Dots up to `value`
 * are coloured from green through amber to blue; the rest are faint.
 */
export function DotGauge({ value, size = 200, label, sub }: { value: number; size?: number; label: string; sub?: string }) {
  const dots = 26;
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const filled = Math.round(Math.max(0, Math.min(1, value)) * dots);
  const palette = [C.ink.green, C.ink.green, C.ink.teal, C.ink.amber, C.ink.orange, C.ink.blue, C.ink.violet];
  return (
    <View style={{ width: size, height: size / 2 + 34, alignItems: "center" }} accessibilityRole="image" accessibilityLabel={`${label}${sub ? `, ${sub}` : ""}`}>
      <Svg width={size} height={size / 2 + 14}>
        {Array.from({ length: dots }, (_, i) => {
          const a = Math.PI + (i / (dots - 1)) * Math.PI;
          const on = i < filled;
          const color = on ? palette[Math.min(palette.length - 1, Math.floor((i / dots) * palette.length))] : C.line;
          const big = on && i === filled - 1;
          return <Circle key={i} cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r={big ? 6 : on ? 4.2 : 3} fill={color} />;
        })}
      </Svg>
      <View style={{ position: "absolute", top: size * 0.2, alignItems: "center" }}>
        <Text style={{ fontSize: size * 0.17, fontWeight: "700", color: C.text, letterSpacing: -1, fontVariant: ["tabular-nums"] }}>{label}</Text>
        {sub ? <Text style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

/** Smooth line of people arriving through the day (cumulative check-ins per hour). */
export function ArrivalsChart({ arrivals, height = 120, ink = "blue" }: { arrivals: { hour: number; count: number }[]; height?: number; ink?: Ink }) {
  const id = useId().replace(/:/g, "");
  // Only the hours that matter: first arrival − 1 to last arrival + 1 (at least 7..20).
  const withCount = arrivals.filter((a) => a.count > 0);
  const from = Math.min(7, ...(withCount.length ? [withCount[0].hour - 1] : []));
  const to = Math.max(20, ...(withCount.length ? [withCount[withCount.length - 1].hour + 1] : []));
  const hours = arrivals.filter((a) => a.hour >= from && a.hour <= to);
  const cum = hours.reduce<number[]>((acc, a) => [...acc, (acc[acc.length - 1] ?? 0) + a.count], []);
  const sum = cum[cum.length - 1] ?? 0;
  const max = Math.max(1, sum);
  const W = 300;
  const H = height;
  const pts = cum.map((v, i) => [(i / Math.max(1, cum.length - 1)) * W, H - 12 - (v / max) * (H - 28)] as const);
  const d = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const mx = (px + x) / 2;
    return `${acc} C${mx},${py} ${mx},${y} ${x},${y}`;
  }, "");
  const color = C.ink[ink];
  const marks = pts.filter((_, i) => hours[i].count > 0 && (i === 0 || hours[i].count >= Math.max(...hours.map((h) => h.count)) * 0.6)).slice(0, 4);
  return (
    <View accessibilityRole="image" accessibilityLabel={`${sum} people arrived today`}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.22} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {pts.length > 1 ? <Path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} /> : null}
        {pts.length > 1 ? <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" /> : null}
        {marks.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={5} fill={C.card} stroke={color} strokeWidth={2.5} />)}
        <Path d={`M0,${H - 1} L${W},${H - 1}`} stroke={C.line} strokeWidth={1} strokeDasharray="3 5" />
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        {[from, Math.round((from + to) / 2), to].map((h) => (
          <Text key={h} style={{ fontSize: 11, color: C.muted }}>{((h + 11) % 12) + 1}{h < 12 ? " am" : " pm"}</Text>
        ))}
      </View>
    </View>
  );
}

const SITE_INKS: Ink[] = ["blue", "green", "pink", "violet", "orange", "teal"];
export const siteInk = (i: number) => SITE_INKS[i % SITE_INKS.length];

/** Proportion bar split by site (reference: the coloured "Accounts" bar in image 5). */
export function SegmentBar({ parts }: { parts: { value: number; ink: Ink }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <View style={{ flexDirection: "row", gap: 4, height: 8 }}>
      {parts.map((p, i) => <View key={i} style={{ flex: Math.max(0.04, p.value / total), height: 8, borderRadius: 4, backgroundColor: C.ink[p.ink] }} />)}
    </View>
  );
}
