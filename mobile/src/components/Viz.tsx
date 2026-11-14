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
/** "8 am", "9:30 pm" */
function clock(m: number) {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}
const toMin = (t?: string) => (t && /^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
const nowIstMin = () => {
  const d = new Date(Date.now() + 5.5 * 3600000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

/**
 * Arrivals today: how many people have scanned in, over the working day. Each arrival is plotted at
 * its real time (a smooth step up), the axis runs from an hour before opening to closing time, and
 * the line stops at "now" (the rest of the day is still to come).
 */
export function ArrivalsChart({
  arrivals,
  arrivalMins,
  open,
  close,
  height = 120,
  ink = "blue",
  staff,
}: {
  /** Total staff: the chart's full height (so 4 of 12 arrived reads as a third). */
  staff?: number;
  arrivals: { hour: number; count: number }[];
  /** IST minutes after midnight of each first scan-in (newer servers). */
  arrivalMins?: number[];
  open?: string;
  close?: string;
  height?: number;
  ink?: Ink;
}) {
  const id = useId().replace(/:/g, "");
  // Drawn at the real width (no stretching): the dot stays round and the line keeps its thickness.
  const [W, setW] = useState(0);
  // Older servers send hourly counts only: treat each as arriving on the hour.
  const times = (arrivalMins ?? arrivals.flatMap((a) => Array.from({ length: a.count }, () => a.hour * 60))).slice().sort((x, y) => x - y);
  const openM = toMin(open) ?? 9 * 60;
  let closeM = toMin(close) ?? 18 * 60;
  if (closeM <= openM) closeM = 24 * 60; // closes after midnight: show up to midnight
  const start = Math.floor(Math.min(openM - 60, times.length ? times[0] - 30 : Infinity) / 60) * 60;
  const end = Math.ceil(Math.max(closeM, times.length ? times[times.length - 1] + 30 : 0) / 60) * 60;
  const now = Math.min(Math.max(nowIstMin(), start), end);
  const total = times.length;
  const H = height;
  const top = 10;
  const bottom = H - 6;
  const x = (m: number) => ((m - start) / (end - start)) * W;
  const y = (n: number) => bottom - (n / Math.max(1, total, staff ?? 0)) * (bottom - top);

  // Smooth steps: flat until shortly before each arrival, then an S-curve up to the new count.
  let d = `M0,${y(0)}`;
  let count = 0;
  let lastX = 0;
  for (let i = 0; i < times.length; ) {
    const t = times[i];
    let n = 0;
    while (i < times.length && times[i] === t) { n++; i++; }
    const tx = x(t);
    const ramp = Math.min(8, tx - lastX);
    const y0 = y(count);
    count += n;
    const y1 = y(count);
    d += ` L${(tx - ramp).toFixed(1)},${y0.toFixed(1)} C${(tx - ramp / 2).toFixed(1)},${y0.toFixed(1)} ${(tx - ramp / 2).toFixed(1)},${y1.toFixed(1)} ${tx.toFixed(1)},${y1.toFixed(1)}`;
    lastX = tx;
  }
  const nx = Math.max(x(now), lastX);
  d += ` L${nx.toFixed(1)},${y(total).toFixed(1)}`;
  const color = C.ink[ink];
  const mid = Math.round((start + end) / 2 / 30) * 30;
  return (
    <View accessibilityRole="image" accessibilityLabel={`${total} people scanned in today`} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {W ? (
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.22} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/* Opening hours band */}
        <Path d={`M${x(openM)},${top} L${x(closeM)},${top} L${x(closeM)},${bottom} L${x(openM)},${bottom} Z`} fill={C.soft} opacity={0.6} />
        <Path d={`M0,${bottom} L${W},${bottom}`} stroke={C.line} strokeWidth={1} strokeDasharray="3 5" />
        {total > 0 ? <Path d={`${d} L${nx},${bottom} L0,${bottom} Z`} fill={`url(#${id})`} /> : null}
        <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Now: dashed marker and the current count */}
        {now < end ? <Path d={`M${nx},${top} L${nx},${bottom}`} stroke={C.faint} strokeWidth={1} strokeDasharray="2 4" /> : null}
        <Circle cx={Math.min(Math.max(nx, 6), W - 6)} cy={y(total)} r={5} fill={C.card} stroke={color} strokeWidth={2.5} />
      </Svg>
      ) : <View style={{ height: H }} />}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        {[start, mid, end].map((m, i) => (
          <Text key={i} style={{ fontSize: 11, color: C.muted }}>{clock(m)}</Text>
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
