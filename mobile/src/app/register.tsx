import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { ErrorView, Loading, Muted } from "@/components/ui";
import { api } from "@/lib/api";
import { monthLabel } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Reg {
  month: string;
  current: string;
  dates: string[];
  rows: { employeeId: string; name: string; days: { date: string; status: string; short: string; manual: boolean; missingOut: boolean }[]; present: number; absent: number; leave: number }[];
}

function shift(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const COLORS: Record<string, { bg: string; fg: string }> = {
  PRESENT: { bg: C.greenSoft, fg: C.green },
  HALF_DAY: { bg: C.greenSoft, fg: C.green },
  ABSENT: { bg: C.redSoft, fg: C.red },
  UNPAID_LEAVE: { bg: C.redSoft, fg: C.red },
  PAID_LEAVE: { bg: C.soft, fg: C.text },
  HOLIDAY: { bg: C.soft, fg: C.muted },
  WEEKLY_OFF: { bg: C.white, fg: C.muted },
};

const CELL = 34;
const NAME = 120;

export default function Register() {
  const [month, setMonth] = useState<string | null>(null);
  const { data, error, refreshing, reload } = useLoad(() => api.get<Reg>(`/api/m/register${month ? `?month=${month}` : ""}`), [month], ["attendance", "employee"]);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: "Attendance register" }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={() => setMonth(shift(data.month, -1))} hitSlop={12} accessibilityLabel="Previous month" style={{ padding: 6 }}>
          <ChevronLeft size={24} color={C.text} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "600", color: C.text }}>{monthLabel(data.month)}</Text>
        <Pressable onPress={() => data.month < data.current && setMonth(shift(data.month, 1))} hitSlop={12} accessibilityLabel="Next month" style={{ padding: 6, opacity: data.month < data.current ? 1 : 0.3 }}>
          <ChevronRight size={24} color={C.text} />
        </Pressable>
      </View>
      <Muted>P present · H half day · A absent · PL paid leave · UL unpaid leave · WO weekly off · HO holiday · * edited · ! no out punch. Tap a day to open it.</Muted>
      <ScrollView horizontal>
        <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Text style={{ width: NAME, padding: 8, fontSize: 12, color: C.muted }}>Employee</Text>
            {data.dates.map((d) => <Text key={d} style={{ width: CELL, paddingVertical: 8, textAlign: "center", fontSize: 12, color: C.muted }}>{Number(d.slice(8))}</Text>)}
            {["P", "A", "L"].map((h) => <Text key={h} style={{ width: CELL + 6, paddingVertical: 8, textAlign: "center", fontSize: 12, color: C.muted }}>{h}</Text>)}
          </View>
          {data.rows.map((r) => (
            <View key={r.employeeId} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Text numberOfLines={1} style={{ width: NAME, padding: 8, fontSize: 13, color: C.text, fontWeight: "500" }}>{r.name}</Text>
              {r.days.map((d) => {
                const c = COLORS[d.status];
                return (
                  <Pressable
                    key={d.date}
                    disabled={!d.short}
                    onPress={() => router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId: r.employeeId, date: d.date } })}
                    style={{ width: CELL, height: 30, alignItems: "center", justifyContent: "center" }}
                  >
                    {d.short ? (
                      <View style={{ minWidth: 28, paddingHorizontal: 2, borderRadius: 4, backgroundColor: c?.bg ?? C.white }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", textAlign: "center", color: c?.fg ?? C.text }}>
                          {d.short}{d.manual ? "*" : ""}{d.missingOut ? "!" : ""}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
              <Text style={{ width: CELL + 6, textAlign: "center", color: C.text }}>{r.present}</Text>
              <Text style={{ width: CELL + 6, textAlign: "center", color: C.text }}>{r.absent}</Text>
              <Text style={{ width: CELL + 6, textAlign: "center", color: C.text }}>{r.leave}</Text>
            </View>
          ))}
          {data.rows.length === 0 ? <Text style={{ padding: 12, color: C.muted }}>No employees.</Text> : null}
        </View>
      </ScrollView>
    </ScrollView>
  );
}
