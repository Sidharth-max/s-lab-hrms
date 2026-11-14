import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/Text";
import { dateLabel } from "@/lib/format";
import { C } from "@/lib/theme";

export interface GridDay { date: string; status: string; short: string; manual: boolean; missingOut: boolean }

const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

function colors(status: string) {
  if (status === "PRESENT") return { bg: C.greenSoft, fg: C.green, border: C.greenLine };
  if (status === "HALF_DAY") return { bg: C.amberSoft, fg: C.amber, border: C.amberLine };
  if (status === "ABSENT" || status === "UNPAID_LEAVE") return { bg: C.redSoft, fg: C.red, border: C.redLine };
  if (status === "FUTURE" || status === "NOT_EMPLOYED") return { bg: C.white, fg: C.faint, border: C.hairline };
  return { bg: C.soft, fg: C.text, border: C.line };
}

/** One person's month as a 7-column calendar. Tap a day to see or fix it. */
export function MonthGrid({ employeeId, month, days, compact }: { employeeId: string; month: string; days: GridDay[]; compact?: boolean }) {
  const first = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const cells: (GridDay | null)[] = [...Array(first).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const gap = compact ? 3 : 5;
  const [today] = useState(istToday);
  // Cell size from the measured width (not flex + aspectRatio): on an open Fold the panel is narrow,
  // and fixed fonts in tiny square cells made the date and letter touch the edges. Narrow cells get
  // a little taller and the text scales down, so both lines always fit.
  const [width, setWidth] = useState(0);
  const cell = width ? Math.floor((width - gap * 6) / 7) : 0;
  const cellH = Math.max(Math.round(cell * (compact ? 0.87 : 1)), 34);
  const numSize = Math.max(9, Math.min(13, Math.round(cell * 0.3)));
  const letterSize = Math.max(9, Math.min(12, Math.round(cell * 0.27)));
  const tight = { includeFontPadding: false, textAlignVertical: "center" as const };
  return (
    <View style={{ gap }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: "row", gap }}>
        {WEEK.map((d, i) => <Text key={i} style={{ width: cell || undefined, flex: cell ? undefined : 1, textAlign: "center", fontSize: 11, color: C.muted, fontWeight: "600" }}>{d}</Text>)}
      </View>
      {cell ? Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={{ flexDirection: "row", gap }}>
          {cells.slice(w * 7, w * 7 + 7).map((d, j) => {
            if (!d) return <View key={j} style={{ width: cell, height: cellH }} />;
            const col = colors(d.status);
            const tappable = d.status !== "FUTURE" && d.status !== "NOT_EMPLOYED";
            const isToday = d.date === today;
            return (
              <Pressable
                key={j}
                disabled={!tappable}
                onPress={() => router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId, date: d.date } })}
                accessibilityLabel={`${dateLabel(d.date)}: ${d.short || d.status}`}
                style={({ pressed }) => [
                  { width: cell, height: cellH, borderRadius: Math.min(12, Math.round(cell * 0.28)), borderWidth: isToday ? 2 : 1, borderColor: isToday ? C.brand : col.border, backgroundColor: col.bg, alignItems: "center", justifyContent: "center", gap: 1 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ ...tight, fontSize: numSize, lineHeight: numSize + 2, color: isToday ? C.brandInk : C.muted, fontWeight: isToday ? "700" : "400" }}>{Number(d.date.slice(8))}</Text>
                {d.short ? <Text numberOfLines={1} style={{ ...tight, fontSize: letterSize, lineHeight: letterSize + 2, fontWeight: "700", color: col.fg }}>{d.short}{d.manual ? "*" : ""}{d.missingOut ? "!" : ""}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      )) : null}
    </View>
  );
}
