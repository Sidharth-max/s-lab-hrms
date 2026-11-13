import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Badge, Card, ErrorView, Loading, Muted, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { addDays, dateLabel, hours } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Day {
  date: string;
  today: string;
  rows: { employeeId: string; name: string; code: string; site: string; status: string; statusLabel: string; inAt: string | null; outAt: string | null; workedMins: number; missingOut: boolean; manual: boolean }[];
}

export default function Attendance() {
  const [date, setDate] = useState<string | null>(null);
  const { data, error, refreshing, reload } = useLoad(() => api.get<Day>(`/api/m/attendance${date ? `?date=${date}` : ""}`), [date], ["attendance", "employee"]);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => setDate(addDays(data.date, -1))} hitSlop={12} accessibilityLabel="Previous day" style={{ padding: 6 }}>
          <ChevronLeft color={C.text} size={24} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "600", color: C.text }}>{data.date === data.today ? "Today" : dateLabel(data.date)}</Text>
        <Pressable
          onPress={() => data.date < data.today && setDate(addDays(data.date, 1))}
          hitSlop={12}
          accessibilityLabel="Next day"
          style={{ padding: 6, opacity: data.date < data.today ? 1 : 0.3 }}
        >
          <ChevronRight color={C.text} size={24} />
        </Pressable>
      </View>
      <Card style={{ padding: 0, gap: 0 }}>
        {data.rows.length === 0 ? <View style={{ padding: 16 }}><Muted>No employees for this date.</Muted></View> : null}
        {data.rows.map((r, i) => (
          <Pressable
            key={r.employeeId}
            onPress={() => router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId: r.employeeId, date: data.date } })}
            style={({ pressed }) => [{ padding: 14, gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }, pressed && { backgroundColor: C.soft }]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, flexShrink: 1 }}>
                {r.name} <Text style={{ color: C.muted, fontWeight: "400" }}>{r.code}</Text>
              </Text>
              <Badge label={r.statusLabel || "—"} tone={r.status === "PRESENT" || r.status === "HALF_DAY" ? "green" : r.status === "ABSENT" || r.status === "UNPAID_LEAVE" ? "red" : "neutral"} />
            </View>
            <Muted>
              In {r.inAt ?? "—"} · Out {r.outAt ?? "—"} · {hours(r.workedMins)}
              {r.manual ? " · manual" : ""}
              {r.missingOut ? " · no out punch" : ""}
            </Muted>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
