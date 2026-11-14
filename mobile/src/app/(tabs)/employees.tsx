import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { BlurFrame } from "@/components/BlurFrame";
import { Text } from "@/components/Text";
import { ChevronRight, Plus, Users } from "@/components/icons";
import { Avatar, Badge, ErrorView, Fab, Loading, Muted, Tabs, Button, refreshProps } from "@/components/ui";
import { rememberNames } from "@/lib/names";
import { haptic } from "@/lib/haptics";
import { Animated, enterAt } from "@/lib/motion";
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
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ employees: Emp[] }>("/api/m/employees").then((d) => { rememberNames(d.employees); return d; }), [], ["employee"]);
  const [show, setShow] = useState<"working" | "left">("working");
  const wide = useWide();
  const [selected, setSelected] = useState<string | null>(null);

  // Searching moved to the round Search button next to the navigation bar (one-hand reach).
  const list = useMemo(() => (data?.employees ?? []).filter((e) => e.active === (show === "working")), [data, show]);

  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const list_ = (
    <View style={{ flex: 1 }}>
    <BlurFrame>{(pad) => (
    <FlatList
      data={list}
      keyExtractor={(e) => e.id}
      refreshControl={<RefreshControl {...refreshProps(refreshing, reload)} />}
      contentContainerStyle={{ padding: 16, paddingTop: 16 + pad, paddingBottom: 96 + FLOATING_NAV_SPACE }}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 12 }}>
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
          <Muted>{show === "left" ? "No archived employees." : "No employees yet. Add the first one to start marking attendance."}</Muted>
          {show === "working" && can("employees.manage") ? <Button title="Add employee" icon={<Plus size={18} color={C.white} />} onPress={() => router.push("/employee/new")} /> : null}
        </View>
      }
      renderItem={({ item: e, index }) => (
        <Animated.View entering={enterAt(index)}>
        <Pressable
          onPress={() => { haptic.tap(); if (wide) setSelected(e.id); else router.push({ pathname: "/employee/[id]", params: { id: e.id, name: e.name } }); }}
          style={({ pressed }) => [
            { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: pressed || (wide && selected === e.id) ? C.soft : C.card, borderColor: C.hairline, borderLeftWidth: 1, borderRightWidth: 1, borderTopWidth: 1 },
            index === 0 && { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
            index === list.length - 1 && { borderBottomWidth: 1, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
          ]}
        >
          <Avatar name={e.name} size={40} muted={!e.active} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }} numberOfLines={1}>
              {e.name} <Text style={{ color: C.muted, fontWeight: "400" }}>{e.code}</Text>
            </Text>
            <Text style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>{e.site} · <Text style={{ color: C.ink.violet, fontWeight: "600" }}>{rs(e.wage)}</Text> {e.wageType === "MONTHLY" ? "/ month" : "/ day"}</Text>
          </View>
          {e.inHouse && e.active ? <Badge label="In-house" /> : null}
          {!e.face && e.active ? <Badge label="No face" tone="red" dot /> : null}
          <ChevronRight size={18} color={C.muted} />
        </Pressable>
        </Animated.View>
      )}
    />
    )}</BlurFrame>
    {can("employees.manage") ? <Fab extended icon={<Plus size={22} color="#ffffff" />} label="Add" lift={wide ? 0 : FLOATING_NAV_SPACE - 8} onPress={() => router.push("/employee/new")} /> : null}
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
