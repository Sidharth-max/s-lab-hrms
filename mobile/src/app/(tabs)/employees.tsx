import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Text, TextInput } from "@/components/Text";
import { ChevronRight, Plus, Search } from "lucide-react-native";
import { Avatar, Badge, ErrorView, Fab, Loading, Muted, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Emp { id: string; name: string; code: string; phone: string | null; site: string; active: boolean; wageType: "MONTHLY" | "DAILY"; wage: number; face: boolean }

export default function Employees() {
  const { can } = useAuth();
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ employees: Emp[] }>("/api/m/employees"), [], ["employee"]);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"working" | "left">("working");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.employees ?? []).filter(
      (e) => e.active === (show === "working") && (!s || e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s) || (e.phone ?? "").includes(s)),
    );
  }, [data, q, show]);

  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
    <FlatList
      data={list}
      keyExtractor={(e) => e.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 8, backgroundColor: C.white, paddingHorizontal: 12 }}>
            <Search size={18} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search name, code or mobile" placeholderTextColor="#a3a3a3" style={{ flex: 1, minHeight: 44, fontSize: 16, color: C.text }} />
          </View>
          <Segmented
            options={[
              { value: "working", label: `Active · ${data.employees.filter((e) => e.active).length}` },
              { value: "left", label: `Archived · ${data.employees.filter((e) => !e.active).length}` },
            ]}
            value={show}
            onChange={setShow}
          />
        </View>
      }
      ListEmptyComponent={<Muted>{show === "left" ? "No archived employees." : "No employees found."}</Muted>}
      renderItem={({ item: e, index }) => (
        <Pressable
          onPress={() => router.push({ pathname: "/employee/[id]", params: { id: e.id } })}
          style={({ pressed }) => [
            { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: pressed ? C.soft : C.white, borderColor: "#ebebeb", borderLeftWidth: 1, borderRightWidth: 1, borderTopWidth: 1 },
            index === 0 && { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
            index === list.length - 1 && { borderBottomWidth: 1, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
          ]}
        >
          <Avatar name={e.name} size={40} muted={!e.active} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }} numberOfLines={1}>
              {e.name} <Text style={{ color: C.muted, fontWeight: "400" }}>{e.code}</Text>
            </Text>
            <Text style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>{e.site} · {rs(e.wage)} {e.wageType === "MONTHLY" ? "/ month" : "/ day"}</Text>
          </View>
          {!e.face && e.active ? <Badge label="No face" tone="red" dot /> : null}
          <ChevronRight size={18} color={C.muted} />
        </Pressable>
      )}
    />
    {can("employees.manage") ? <Fab icon={<Plus size={26} color={C.white} />} label="Add employee" onPress={() => router.push("/employee/new")} /> : null}
    </View>
  );
}
