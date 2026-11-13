import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Text, TextInput } from "@/components/Text";
import { ChevronRight, Search } from "@/components/icons";
import { Avatar, Badge, ErrorView, Loading, Muted, Tabs } from "@/components/ui";
import { MonthField } from "@/components/pickers";
import { MonthGrid, type GridDay } from "@/components/MonthGrid";
import { api } from "@/lib/api";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Reg {
  month: string;
  current: string;
  dates: string[];
  rows: { employeeId: string; name: string; days: GridDay[]; present: number; absent: number; leave: number }[];
}

/** Monthly register on a phone: one card per employee with their month calendar (no wide table). */
export default function Register() {
  const [month, setMonth] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"active" | "all" | "archived">("active");
  const { data, error, refreshing, reload } = useLoad(() => api.get<Reg>(`/api/m/register?show=${show}${month ? `&month=${month}` : ""}`), [month, show], ["attendance", "employee"]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => !s || r.name.toLowerCase().includes(s));
  }, [data, q]);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <>
      <Stack.Screen options={{ title: "Attendance register" }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.employeeId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <MonthField value={data.month} onChange={setMonth} max={data.current} />
            <Tabs options={[{ value: "active", label: "Active" }, { value: "all", label: "All" }, { value: "archived", label: "Archived" }]} value={show} onChange={setShow} />
            {data.rows.length > 4 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.white, paddingHorizontal: 12 }}>
                <Search size={18} color={C.muted} />
                <TextInput value={q} onChangeText={setQ} placeholder="Search employee…" placeholderTextColor="#a3a3a3" style={{ flex: 1, minHeight: 44, fontSize: 15, color: C.text }} />
              </View>
            ) : null}
            <Muted>P present · H half · A absent · PL/UL leave · WO off · HO holiday · * edited · ! no out punch. Tap a day to open it.</Muted>
          </View>
        }
        ListEmptyComponent={<Muted>No employees in this month.</Muted>}
        renderItem={({ item: r }) => (
          <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: "#ebebeb", borderRadius: 14, padding: 14, gap: 12 }}>
            <Pressable onPress={() => router.push({ pathname: "/employee/[id]", params: { id: r.employeeId } })} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Avatar name={r.name} size={36} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: C.text }} numberOfLines={1}>{r.name}</Text>
              <ChevronRight size={18} color={C.muted} />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Badge label={`Present ${r.present}`} tone="green" dot />
              <Badge label={`Absent ${r.absent}`} tone="red" dot />
              <Badge label={`Leave ${r.leave}`} />
            </View>
            <MonthGrid employeeId={r.employeeId} month={data.month} days={r.days} compact />
          </View>
        )}
      />
    </>
  );
}
