import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil } from "@/components/icons";
import { DateField, DatePickerSheet } from "@/components/pickers";
import { EmployeePicker } from "@/components/EmployeePicker";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, ErrorView, Fab, Loading, Muted, refreshProps, Screen, Tabs } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { rememberNames } from "@/lib/names";
import { haptic } from "@/lib/haptics";
import { PressScale } from "@/lib/motion";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { addDays, dateLabel, hours } from "@/lib/format";
import { C, shadow, statusTone } from "@/lib/theme";
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
  const { data, error, refreshing, reload } = useLoad(
    () => api.get<Day>(`/api/m/attendance?show=${show}${date ? `&date=${date}` : ""}`).then((d) => { rememberNames(d.rows); return d; }),
    [date, show],
    ["attendance", "employee"],
  );
  const insets = useSafeAreaInsets();
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const go = (d: string) => { haptic.select(); setDate(d); };
  // Day switcher. Phones: floating just above the navigation bar (thumb zone). Wide: top of the list.
  const dateBar = (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.card, borderRadius: 999, borderWidth: 1, borderColor: C.hairline, padding: 6 }, shadow(wide ? 1 : 3)]}>
      <Pressable onPress={() => go(addDays(data.date, -1))} hitSlop={8} accessibilityLabel="Previous day" style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.track }}>
        <ChevronLeft color={C.text} size={22} />
      </Pressable>
      <Pressable onPress={() => setPicking(true)} accessibilityLabel="Choose date" style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, paddingHorizontal: 6 }}>
        <CalendarDays size={18} color={C.brandInk} />
        {/* Shrinks (one line, slightly smaller text) on a narrow panel instead of running over the arrows. */}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1, fontSize: 16, fontWeight: "700", color: C.text }}>{wide ? (data.date === data.today ? "Today" : dateLabel(data.date).replace(/ \d{4}$/, "")) : data.date === data.today ? `Today · ${dateLabel(data.date)}` : dateLabel(data.date)}</Text>
      </Pressable>
      <Pressable
        onPress={() => data.date < data.today && go(addDays(data.date, 1))}
        hitSlop={8}
        accessibilityLabel="Next day"
        accessibilityState={{ disabled: data.date >= data.today }}
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.track, opacity: data.date < data.today ? 1 : 0.35 }}
      >
        <ChevronRight color={C.text} size={22} />
      </Pressable>
    </View>
  );
  const counts = data.rows.reduce((a, r) => { a[statusTone(r.status)]++; return a; }, { green: 0, amber: 0, red: 0, neutral: 0 } as Record<string, number>);

  const list = (
    <Screen tabs={!wide} bottomSpace={wide ? 0 : 72} refreshControl={<RefreshControl {...refreshProps(refreshing, reload)} />}>
      {/* Picking a date refreshes the list at once (no "Go" button). */}
      {picking ? <DatePickerSheet visible value={data.date} max={data.today} onChange={go} onClose={() => setPicking(false)} /> : null}
      {editing ? (
        <Sheet visible onClose={() => setEditing(false)} title="Add or fix attendance" footer={
          <Button
            title="Open day"
            disabled={!editEmp}
            onPress={() => {
              const d = editDate ?? data.date;
              const name = emps.data?.employees.find((x) => x.id === editEmp)?.name;
              if (wide) setSelected({ employeeId: editEmp, date: d });
              else router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId: editEmp, date: d, name } });
              setEditing(false);
            }}
          />
        }>
          <Muted>Pick the person and the day. You can then mark the in and out time, or set leave / absent.</Muted>
          <EmployeePicker employees={(emps.data?.employees ?? []).filter((e) => e.active)} value={editEmp} onChange={setEditEmp} />
          <DateField label="Day" value={editDate ?? data.date} onChange={setEditDate} max={data.today} />
        </Sheet>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.hairline }}><Text style={{ fontSize: 22, fontWeight: "700", color: C.ink.green }}>{counts.green}</Text><Text style={{ fontSize: 12, color: C.muted }}>Present</Text></View>
        <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.hairline }}><Text style={{ fontSize: 22, fontWeight: "700", color: C.ink.amber }}>{counts.amber}</Text><Text style={{ fontSize: 12, color: C.muted }}>Half day</Text></View>
        <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.hairline }}><Text style={{ fontSize: 22, fontWeight: "700", color: C.ink.red }}>{counts.red}</Text><Text style={{ fontSize: 12, color: C.muted }}>Absent</Text></View>
      </View>
      {wide ? dateBar : null}
      <Tabs options={[{ value: "active", label: "Active" }, { value: "all", label: "All" }, { value: "archived", label: "Archived" }]} value={show} onChange={setShow} />
      <Card style={{ padding: 0, gap: 0 }}>
        {data.rows.length === 0 ? <View style={{ padding: 16 }}><Muted>No employees for this date.</Muted></View> : null}
        {data.rows.map((r, i) => (
          <Pressable
            key={r.employeeId}
            onPress={() => { if (wide) setSelected({ employeeId: r.employeeId, date: data.date }); else router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId: r.employeeId, date: data.date, name: r.name } }); }}
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
              In <Text style={{ color: r.inAt ? C.ink.teal : C.muted, fontWeight: r.inAt ? "600" : "400" }}>{r.inAt ?? "—"}</Text> · Out <Text style={{ color: r.outAt ? C.ink.blue : C.muted, fontWeight: r.outAt ? "600" : "400" }}>{r.outAt ?? "—"}</Text> · {hours(r.workedMins)}
              {r.manual ? " · manual" : ""}
              {r.missingOut ? <Text style={{ color: C.ink.red }}> · no out punch</Text> : null}
            </Muted>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
  if (!wide) {
    return (
      <View style={{ flex: 1 }}>
        {list}
        <View pointerEvents="box-none" style={{ position: "absolute", left: 14, right: 14, bottom: Math.max(insets.bottom, 10) + 8 + 64 + 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
          <View style={{ flex: 1 }}>{dateBar}</View>
          {can("attendance.edit") ? (
            <PressScale onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Add or fix attendance" style={[{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.head, alignItems: "center", justifyContent: "center" }, shadow(3)]}>
              <Pencil size={22} color={C.headText} />
            </PressScale>
          ) : null}
        </View>
      </View>
    );
  }
  return (
    <TwoPane
      left={<View style={{ flex: 1 }}>{list}{can("attendance.edit") ? <Fab extended icon={<Pencil size={20} color="#ffffff" />} label="Fix a day" onPress={() => setEditing(true)} /> : null}</View>}
      right={selected ? <DayView key={`${selected.employeeId}-${selected.date}`} employeeId={selected.employeeId} date={selected.date} embedded /> : <PanePlaceholder icon={<CalendarDays size={40} color={C.faint} />} text="Choose a person to see or fix their day" />}
    />
  );
}
