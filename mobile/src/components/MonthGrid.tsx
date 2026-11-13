import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "@/components/Text";
import { dateLabel } from "@/lib/format";
import { C } from "@/lib/theme";

export interface GridDay { date: string; status: string; short: string; manual: boolean; missingOut: boolean }

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

function colors(status: string) {
  if (status === "PRESENT") return { bg: C.greenSoft, fg: C.green, border: "#bbf7d0" };
  if (status === "HALF_DAY") return { bg: C.amberSoft, fg: C.amber, border: C.amberLine };
  if (status === "ABSENT" || status === "UNPAID_LEAVE") return { bg: C.redSoft, fg: C.red, border: "#fecaca" };
  if (status === "FUTURE" || status === "NOT_EMPLOYED") return { bg: C.white, fg: "#c4c4c4", border: "#f0f0f0" };
  return { bg: C.soft, fg: C.text, border: C.line };
}

/** One person's month as a 7-column calendar. Tap a day to see or fix it. */
export function MonthGrid({ employeeId, month, days, compact }: { employeeId: string; month: string; days: GridDay[]; compact?: boolean }) {
  const first = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const cells: (GridDay | null)[] = [...Array(first).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const gap = compact ? 3 : 4;
  return (
    <View style={{ gap }}>
      <View style={{ flexDirection: "row", gap }}>
        {WEEK.map((d, i) => <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: C.muted, fontWeight: "600" }}>{d}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={{ flexDirection: "row", gap }}>
          {cells.slice(w * 7, w * 7 + 7).map((d, j) => {
            if (!d) return <View key={j} style={{ flex: 1, aspectRatio: compact ? 1.15 : 1 }} />;
            const col = colors(d.status);
            const tappable = d.status !== "FUTURE" && d.status !== "NOT_EMPLOYED";
            return (
              <Pressable
                key={j}
                disabled={!tappable}
                onPress={() => router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId, date: d.date } })}
                accessibilityLabel={`${dateLabel(d.date)}: ${d.short || d.status}`}
                style={({ pressed }) => [
                  { flex: 1, aspectRatio: compact ? 1.15 : 1, borderRadius: compact ? 6 : 8, borderWidth: 1, borderColor: col.border, backgroundColor: col.bg, alignItems: "center", justifyContent: "center" },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ fontSize: compact ? 10 : 12, color: C.muted }}>{Number(d.date.slice(8))}</Text>
                {d.short ? <Text style={{ fontSize: compact ? 10 : 11, fontWeight: "700", color: col.fg }}>{d.short}{d.manual ? "*" : ""}{d.missingOut ? "!" : ""}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
