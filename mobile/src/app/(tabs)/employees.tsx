import { router, useNavigation } from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { Plus, Search } from "lucide-react-native";
import { Badge, ErrorView, Loading, Muted, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Emp { id: string; name: string; code: string; phone: string | null; site: string; active: boolean; wageType: "MONTHLY" | "DAILY"; wage: number; face: boolean }

export default function Employees() {
  const { can } = useAuth();
  const nav = useNavigation();
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ employees: Emp[] }>("/api/m/employees"));
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"working" | "left">("working");

  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: can("employees.manage")
        ? () => (
            <Pressable onPress={() => router.push("/employee/new")} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16 }} accessibilityLabel="Add employee">
              <Plus size={20} color={C.text} />
              <Text style={{ fontWeight: "600", color: C.text }}>Add</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [nav, can]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.employees ?? []).filter(
      (e) => e.active === (show === "working") && (!s || e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s) || (e.phone ?? "").includes(s)),
    );
  }, [data, q, show]);

  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <FlatList
      data={list}
      keyExtractor={(e) => e.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 8, backgroundColor: C.white, paddingHorizontal: 12 }}>
            <Search size={18} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search name, code or mobile" placeholderTextColor="#a3a3a3" style={{ flex: 1, minHeight: 44, fontSize: 16, color: C.text }} />
          </View>
          <Segmented options={[{ value: "working", label: "Working" }, { value: "left", label: "Left" }]} value={show} onChange={setShow} />
        </View>
      }
      ListEmptyComponent={<Muted>No employees found.</Muted>}
      renderItem={({ item: e }) => (
        <Pressable
          onPress={() => router.push({ pathname: "/employee/[id]", params: { id: e.id } })}
          style={({ pressed }) => [{ backgroundColor: pressed ? C.soft : C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, gap: 4 }]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, flexShrink: 1 }}>
              {e.name} <Text style={{ color: C.muted, fontWeight: "400" }}>{e.code}</Text>
            </Text>
            {!e.face && e.active ? <Badge label="No face" /> : null}
          </View>
          <Muted>{e.site} · {rs(e.wage)} {e.wageType === "MONTHLY" ? "/ month" : "/ day"}</Muted>
        </Pressable>
      )}
    />
  );
}
