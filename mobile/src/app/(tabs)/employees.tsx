import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Text, TextInput } from "@/components/Text";
import { ChevronRight, Plus, Search, Users } from "@/components/icons";
import { Avatar, Badge, ErrorView, Fab, Loading, Muted, Tabs, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { FLOATING_NAV_SPACE, useWide } from "@/lib/layout";
import { PanePlaceholder, TwoPane } from "@/components/TwoPane";
import { EmployeeDetailView } from "@/components/EmployeeDetailView";

interface Emp { id: string; name: string; code: string; phone: string | null; site: string; active: boolean; wageType: "MONTHLY" | "DAILY"; wage: number; face: boolean; inHouse?: boolean }

export default function Employees() {
  const { can } = useAuth();
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ employees: Emp[] }>("/api/m/employees"), [], ["employee"]);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"working" | "left">("working");
  const wide = useWide();
  const [selected, setSelected] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.employees ?? []).filter(
      (e) => e.active === (show === "working") && (!s || e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s) || (e.phone ?? "").includes(s)),
    );
  }, [data, q, show]);

  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const list_ = (
    <View style={{ flex: 1 }}>
    <FlatList
      data={list}
      keyExtractor={(e) => e.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      contentContainerStyle={{ padding: 16, paddingBottom: wide ? 96 : 96 + FLOATING_NAV_SPACE }}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 999, backgroundColor: C.white, paddingHorizontal: 12 }}>
            <Search size={18} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search name, code or mobile…" placeholderTextColor={C.placeholder} style={{ flex: 1, minHeight: 44, fontSize: 16, color: C.text }} />
          </View>
          <Tabs
            options={[
              { value: "working", label: `Active · ${data.employees.filter((e) => e.active).length}` },
              { value: "left", label: `Archived · ${data.employees.filter((e) => !e.active).length}` },
            ]}
            value={show}
            onChange={setShow}
          />
        </View>
      }
      ListEmptyComponent={
        <View style={{ gap: 12, alignItems: "flex-start" }}>
          <Muted>{show === "left" ? "No archived employees." : q.trim() ? "No employee matches this search." : "No employees yet. Add the first one to start marking attendance."}</Muted>
          {show === "working" && !q.trim() && can("employees.manage") ? <Button title="Add employee" icon={<Plus size={18} color={C.white} />} onPress={() => router.push("/employee/new")} /> : null}
        </View>
      }
      renderItem={({ item: e, index }) => (
        <Pressable
          onPress={() => (wide ? setSelected(e.id) : router.push({ pathname: "/employee/[id]", params: { id: e.id } }))}
          style={({ pressed }) => [
            { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: pressed || (wide && selected === e.id) ? C.soft : C.white, borderColor: C.hairline, borderLeftWidth: 1, borderRightWidth: 1, borderTopWidth: 1 },
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
          {e.inHouse && e.active ? <Badge label="In-house" /> : null}
          {!e.face && e.active ? <Badge label="No face" tone="red" dot /> : null}
          <ChevronRight size={18} color={C.muted} />
        </Pressable>
      )}
    />
    {can("employees.manage") ? <Fab icon={<Plus size={26} color={C.white} />} label="Add employee" lift={wide ? 0 : FLOATING_NAV_SPACE - 8} onPress={() => router.push("/employee/new")} /> : null}
    </View>
  );
  if (!wide) return list_;
  return (
    <TwoPane
      left={list_}
      right={selected ? <EmployeeDetailView key={selected} id={selected} embedded /> : <PanePlaceholder icon={<Users size={40} color={C.faint} />} text="Choose an employee to see their details" />}
    />
  );
}
