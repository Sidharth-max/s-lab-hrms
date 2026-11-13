import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Text, TextInput } from "@/components/Text";
import { ChevronRight, Search } from "@/components/icons";
import { Avatar, Badge, Card, ErrorView, Loading, Muted, Tabs } from "@/components/ui";
import { api } from "@/lib/api";
import { dateLabel, rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { FLOATING_NAV_SPACE } from "@/lib/layout";

interface Row { employeeId: string; name: string; code: string; active: boolean; earned: number; advances: number; payments: number; balance: number; lastPaidOn: string | null }

/** Everyone's salary hisaab: one running balance per person, no salary months. Tap a person to pay. */
export default function SalaryScreen() {
  const [show, setShow] = useState<"active" | "all" | "archived">("active");
  const [q, setQ] = useState("");
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ rows: Row[]; toPay: number; owed: number }>(`/api/m/salary?show=${show}`), [show], ["salary", "advance", "approval", "attendance", "employee"]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => !s || r.name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s));
  }, [data, q]);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <>
      <Stack.Screen options={{ title: "Salary" }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.employeeId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 96 + FLOATING_NAV_SPACE }}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <Card>
              <Muted>Total to pay</Muted>
              <Text style={{ fontSize: 26, fontWeight: "700", color: C.text, letterSpacing: -0.5 }}>{rs(data.toPay)}</Text>
              {data.owed > 0 ? <Muted>Owed by employees (advance more than salary): {rs(data.owed)}</Muted> : null}
              <Muted>Salary earned since joining, minus advances and salary paid. Open a person to pay or clear it.</Muted>
            </Card>
            <Tabs options={[{ value: "active", label: "Active" }, { value: "all", label: "All" }, { value: "archived", label: "Archived" }]} value={show} onChange={setShow} />
            {data.rows.length > 4 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 999, backgroundColor: C.white, paddingHorizontal: 12 }}>
                <Search size={18} color={C.muted} />
                <TextInput value={q} onChangeText={setQ} placeholder="Search employee…" placeholderTextColor={C.placeholder} style={{ flex: 1, minHeight: 44, fontSize: 15, color: C.text }} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={<Muted>No employees.</Muted>}
        renderItem={({ item: r }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/employee/[id]", params: { id: r.employeeId, tab: "hisaab" } })}
            style={({ pressed }) => [{ backgroundColor: C.white, borderWidth: 1, borderColor: C.hairline, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, pressed && { opacity: 0.8 }]}
          >
            <Avatar name={r.name} size={38} muted={!r.active} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }} numberOfLines={1}>{r.name}</Text>
              <Muted>{r.code}{r.lastPaidOn ? ` · paid ${dateLabel(r.lastPaidOn)}` : " · never paid"}{r.active ? "" : " · archived"}</Muted>
            </View>
            {r.balance === 0 ? (
              <Badge label="Clear" tone="green" />
            ) : (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: r.balance < 0 ? C.red : C.text }}>{rs(Math.abs(r.balance))}</Text>
                <Muted>{r.balance < 0 ? "owes" : "to pay"}</Muted>
              </View>
            )}
            <ChevronRight size={18} color={C.muted} />
          </Pressable>
        )}
      />
    </>
  );
}
