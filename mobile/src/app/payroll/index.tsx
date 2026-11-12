import { router, Stack } from "expo-router";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { Badge, Button, Card, ErrorView, Loading, Muted, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { monthLabel, rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Run { month: string; locked: boolean; employees: number; net: number; paid: number }

function monthKey(offset = 0) {
  const d = new Date(Date.now() + 5.5 * 3600000);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}

export default function PayrollList() {
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ runs: Run[] }>("/api/m/payroll"));
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const missing = [monthKey(-1), monthKey(0)].filter((m) => !data.runs.some((r) => r.month === m));
  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Stack.Screen options={{ title: "Salary" }} />
      {missing.map((m) => (
        <Button key={m} title={`Prepare ${monthLabel(m)}`} onPress={() => router.push({ pathname: "/payroll/[month]", params: { month: m } })} />
      ))}
      <Card style={{ padding: 0, gap: 0 }}>
        {data.runs.length === 0 ? <View style={{ padding: 16 }}><Muted>No salary prepared yet.</Muted></View> : null}
        {data.runs.map((r, i) => (
          <Pressable key={r.month} onPress={() => router.push({ pathname: "/payroll/[month]", params: { month: r.month } })} style={{ padding: 14, gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "600", color: C.text }}>{monthLabel(r.month)}</Text>
              <Badge label={r.locked ? "Locked" : "Draft"} tone={r.locked ? "green" : "neutral"} />
            </View>
            <Muted>{r.employees} employees · net {rs(r.net)} · paid {rs(r.paid)}</Muted>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
