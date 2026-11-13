import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil } from "@/components/icons";
import { DateField, DatePickerSheet } from "@/components/pickers";
import { EmployeePicker } from "@/components/EmployeePicker";
import { useAuth } from "@/lib/auth";
import {Badge, Button, Card, ErrorView, H2, Loading, Muted, Screen, Tabs } from "@/components/ui";
import { api } from "@/lib/api";
import { addDays, dateLabel, hours } from "@/lib/format";
import { C, statusTone } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { useWide } from "@/lib/layout";
import { PanePlaceholder, TwoPane } from "@/components/TwoPane";
import { DayView } from "@/components/DayView";

interface Day {
  date: string;
  today: string;
  rows: { archived?: boolean; employeeId: string; name: string; code: string; site: string; status: string; statusLabel: string; inAt: string | null; outAt: string | null; workedMins: number; missingOut: boolean; manual: boolean }[];
}

export default function Attendance() {
  const [date, setDate] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [show, setShow] = useState<"active" | "all" | "archived">("active");
  const wide = useWide();
  const { can } = useAuth();
  const emps = useLoad(() => api.get<{ employees: { id: string; name: string; code: string; site: string; active: boolean }[] }>("/api/m/employees"), [], ["employee"]);
  const [editing, setEditing] = useState(false);
  const [editEmp, setEditEmp] = useState("");
  const [editDate, setEditDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ employeeId: string; date: string } | null>(null);
  const { data, error, refreshing, reload } = useLoad(() => api.get<Day>(`/api/m/attendance?show=${show}${date ? `&date=${date}` : ""}`), [date, show], ["attendance", "employee"]);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const list = (
    <Screen tabs refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      {picking ? <DatePickerSheet visible value={data.date} max={data.today} onChange={setDate} onClose={() => setPicking(false)} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => setDate(addDays(data.date, -1))} hitSlop={12} accessibilityLabel="Previous day" style={{ padding: 6 }}>
          <ChevronLeft color={C.text} size={24} />
        </Pressable>
        <Pressable onPress={() => setPicking(true)} hitSlop={8} accessibilityLabel="Choose date" style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }}>
          <CalendarDays size={18} color={C.text} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>{data.date === data.today ? `Today · ${dateLabel(data.date)}` : dateLabel(data.date)}</Text>
        </Pressable>
        <Pressable
          onPress={() => data.date < data.today && setDate(addDays(data.date, 1))}
          hitSlop={12}
          accessibilityLabel="Next day"
          style={{ padding: 6, opacity: data.date < data.today ? 1 : 0.3 }}
        >
          <ChevronRight color={C.text} size={24} />
        </Pressable>
      </View>
      {can("attendance.edit") ? (
        editing ? (
          <Card>
            <H2>Add or edit attendance</H2>
            <Muted>Pick the person and the day. You can then mark the in and out time, or set leave / absent.</Muted>
            <EmployeePicker employees={(emps.data?.employees ?? []).filter((e) => e.active)} value={editEmp} onChange={setEditEmp} />
            <DateField label="Day" value={editDate ?? data.date} onChange={setEditDate} max={data.today} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Button title="Close" variant="secondary" onPress={() => setEditing(false)} /></View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Open day"
                  disabled={!editEmp}
                  onPress={() => {
                    const d = editDate ?? data.date;
                    if (wide) setSelected({ employeeId: editEmp, date: d });
                    else router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId: editEmp, date: d } });
                    setEditing(false);
                  }}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Button title="Add or edit attendance" icon={<Pencil size={18} color={C.white} />} onPress={() => setEditing(true)} />
        )
      ) : null}
      <Tabs options={[{ value: "active", label: "Active" }, { value: "all", label: "All" }, { value: "archived", label: "Archived" }]} value={show} onChange={setShow} />
      <Card style={{ padding: 0, gap: 0 }}>
        {data.rows.length === 0 ? <View style={{ padding: 16 }}><Muted>No employees for this date.</Muted></View> : null}
        {data.rows.map((r, i) => (
          <Pressable
            key={r.employeeId}
            onPress={() => (wide ? setSelected({ employeeId: r.employeeId, date: data.date }) : router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId: r.employeeId, date: data.date } }))}
            style={({ pressed }) => [{ padding: 14, gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }, (pressed || (wide && selected?.employeeId === r.employeeId && selected.date === data.date)) && { backgroundColor: C.soft }]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, flexShrink: 1 }}>
                {r.name} <Text style={{ color: C.muted, fontWeight: "400" }}>{r.code}{r.archived ? " · archived" : ""}</Text>
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Badge label={r.statusLabel || "—"} tone={statusTone(r.status)} />
                <Pencil size={16} color={C.muted} />
              </View>
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
  if (!wide) return list;
  return (
    <TwoPane
      left={list}
      right={selected ? <DayView key={`${selected.employeeId}-${selected.date}`} employeeId={selected.employeeId} date={selected.date} embedded /> : <PanePlaceholder icon={<CalendarDays size={40} color={C.faint} />} text="Choose a person to see or fix their day" />}
    />
  );
}
