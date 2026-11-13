import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, Switch, Text, View } from "react-native";
import { Badge, Button, Card, ErrorView, Field, H2, Loading, Muted, Notice, Screen, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { TimeField } from "@/components/pickers";

interface DayDetail {
  employee: { id: string; name: string; code: string };
  date: string;
  status: string;
  statusLabel: string;
  manual: boolean;
  locked: boolean;
  editable: boolean;
  punches: { id: string; type: "IN" | "OUT"; time: string; source: "FACE" | "MANUAL"; score: number | null; reason: string | null; by: string | null; voided: boolean; voidReason: string | null }[];
  history: { at: string; by: string | null; status: string; reason: string }[];
}

const STATUSES = [
  { value: "PRESENT", label: "Present" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "ABSENT", label: "Absent" },
  { value: "PAID_LEAVE", label: "Paid leave" },
  { value: "UNPAID_LEAVE", label: "Unpaid leave" },
];

export default function DayScreen() {
  const { employeeId, date } = useLocalSearchParams<{ employeeId: string; date: string }>();
  const { data, error, refreshing, reload } = useLoad(() => api.get<DayDetail>(`/api/m/attendance/${employeeId}/${date}`), [employeeId, date], ["attendance"]);
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [time, setTime] = useState("");
  const [nextDay, setNextDay] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("PRESENT");
  const [statusReason, setStatusReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function run(name: string, body: Record<string, unknown>, after?: () => void) {
    setBusy(name);
    setMsg(null);
    try {
      const r = await api.action(name, body);
      setMsg({ text: r.message ?? "Saved", ok: true });
      after?.();
      await reload();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy(null);
    }
  }

  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Stack.Screen options={{ title: data.employee.name }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 17, fontWeight: "600", color: C.text }}>{dateLabel(data.date)}</Text>
        <Badge label={data.statusLabel || "—"} tone={data.status === "PRESENT" || data.status === "HALF_DAY" ? "green" : data.status === "ABSENT" ? "red" : "neutral"} />
      </View>
      {data.locked ? <Notice text="Salary for this month is locked, so this day cannot be edited. Add an adjustment in next month's salary." /> : null}
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}

      <Card style={{ gap: 0 }}>
        <H2>Punches</H2>
        {data.punches.length === 0 ? <Muted style={{ paddingTop: 8 }}>No punches.</Muted> : null}
        {data.punches.map((p) => (
          <View key={p.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, opacity: p.voided ? 0.5 : 1, gap: 2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "600", color: C.text, textDecorationLine: p.voided ? "line-through" : "none" }}>{p.type} · {p.time}</Text>
              {data.editable && !p.voided ? (
                <Pressable
                  onPress={() => Alert.alert("Remove this punch?", "It stays in history.", [{ text: "Cancel" }, { text: "Remove", style: "destructive", onPress: () => run("voidPunch", { punchId: p.id }) }])}
                  hitSlop={8}
                >
                  <Text style={{ color: C.red, fontWeight: "600" }}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <Muted>
              {p.source === "FACE" ? `Face scan${p.score ? ` (${p.score.toFixed(1)}%)` : ""}` : `Manual by ${p.by ?? "?"}: ${p.reason ?? ""}`}
              {p.voided ? ` · removed: ${p.voidReason ?? ""}` : ""}
            </Muted>
          </View>
        ))}
      </Card>

      {data.editable ? (
        <>
          <Card>
            <H2>Add missed punch</H2>
            <Segmented options={[{ value: "IN", label: "IN" }, { value: "OUT", label: "OUT" }]} value={type} onChange={setType} />
            <TimeField label="Time" value={time} onChange={setTime} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Switch value={nextDay} onValueChange={setNextDay} trackColor={{ true: C.green, false: C.line }} />
              <Text style={{ color: C.text }}>Time is after midnight (night shift)</Text>
            </View>
            <Field label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. tablet not working" />
            <Button
              title="Add punch"
              loading={busy === "addManualPunch"}
              disabled={!/^\d{2}:\d{2}$/.test(time) || reason.trim().length < 3}
              onPress={() => run("addManualPunch", { employeeId, date, type, time, nextDay, reason }, () => { setTime(""); setReason(""); })}
            />
          </Card>
          <Card>
            <H2>Set day status</H2>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {STATUSES.map((s) => (
                <Pressable key={s.value} onPress={() => setStatus(s.value)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: status === s.value ? C.text : C.line, backgroundColor: status === s.value ? C.text : C.white }}>
                  <Text style={{ color: status === s.value ? C.white : C.text }}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Reason" value={statusReason} onChangeText={setStatusReason} />
            <Button title="Set status" loading={busy === "setDayStatus"} disabled={statusReason.trim().length < 3} onPress={() => run("setDayStatus", { employeeId, date, status, reason: statusReason }, () => setStatusReason(""))} />
            {data.manual ? <Button title="Back to automatic (from scans)" variant="secondary" loading={busy === "clearDayStatus"} onPress={() => run("clearDayStatus", { employeeId, date })} /> : null}
          </Card>
        </>
      ) : null}

      {data.history.length ? (
        <Card>
          <H2>Edit history</H2>
          {data.history.map((h, i) => (
            <Muted key={i}>
              {new Date(h.at).toLocaleString()} · {h.by ?? "?"} set {h.status === "AUTO" ? "automatic" : h.status.replace("_", " ").toLowerCase()}: {h.reason}
            </Muted>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
