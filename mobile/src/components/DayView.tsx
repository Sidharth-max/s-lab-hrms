import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { Badge, Button, Card, ErrorView, Field, H2, Loading, Muted, Notice, Screen, Toggle } from "@/components/ui";
import { api } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { C, statusTone } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { TimeField } from "@/components/pickers";
import { useDialog } from "@/components/dialog";
import { useUnsavedGuard } from "@/lib/unsaved";

interface DayDetail {
  employee: { id: string; name: string; code: string };
  date: string;
  status: string;
  statusLabel: string;
  manual: boolean;
  locked: boolean;
  editable: boolean;
  hours?: { open: string; close: string };
  punches: { id: string; type: "IN" | "OUT"; time: string; source: "FACE" | "MANUAL"; score: number | null; reason: string | null; by: string | null; voided: boolean; voidReason: string | null }[];
  history: { at: string; by: string | null; status: string; reason: string }[];
}

/**
 * Mark the day by hand: separate In and Out times (each with its own picker), set to the store's
 * hours by default so one tap marks a full day. Either time can be switched off.
 */
function MarkAttendance({ hours, busy, onSave }: { hours: { open: string; close: string }; busy: boolean; onSave: (body: Record<string, unknown>) => void }) {
  const [useIn, setUseIn] = useState(true);
  const [useOut, setUseOut] = useState(true);
  const [inTime, setInTime] = useState(hours.open);
  const [outTime, setOutTime] = useState(hours.close);
  const [nextDay, setNextDay] = useState(false);
  const [reason, setReason] = useState("");
  const full = useIn && useOut && inTime === hours.open && outTime === hours.close;
  useUnsavedGuard(!busy && (!!reason || !full || nextDay));
  return (
    <Card>
      <H2>Mark attendance</H2>
      <Muted>Full day is filled in ({hours.open} to {hours.close}). Change the times or switch one off for a missed punch.</Muted>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>In time</Text>
            <Toggle value={useIn} onValueChange={setUseIn} label="Add in time" />
          </View>
          {useIn ? <TimeField value={inTime} onChange={setInTime} compact /> : <Muted>No in time</Muted>}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>Out time</Text>
            <Toggle value={useOut} onValueChange={setUseOut} label="Add out time" />
          </View>
          {useOut ? <TimeField value={outTime} onChange={setOutTime} compact /> : <Muted>No out time</Muted>}
        </View>
      </View>
      {useOut ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Toggle value={nextDay} onValueChange={setNextDay} label="Out time is after midnight" />
          <Text style={{ color: C.text, flex: 1 }}>Out time is after midnight (night shift)</Text>
        </View>
      ) : null}
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. forgot to scan…" />
      <Button
        title={full ? "Mark present (full day)" : "Save times"}
        loading={busy}
        disabled={!useIn && !useOut}
        onPress={() => onSave({ inTime: useIn ? inTime : "", outTime: useOut ? outTime : "", nextDay: useOut && nextDay, reason })}
      />
    </Card>
  );
}

const STATUSES = [
  { value: "PRESENT", label: "Present" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "ABSENT", label: "Absent" },
  { value: "PAID_LEAVE", label: "Paid leave" },
  { value: "UNPAID_LEAVE", label: "Unpaid leave" },
];

/** One employee's day. Its own screen, or (embedded) the right-hand panel on wide screens. */
export function DayView({ employeeId, date, embedded }: { employeeId: string; date: string; embedded?: boolean }) {
  const dialog = useDialog();
  const { data, error, refreshing, reload } = useLoad(() => api.get<DayDetail>(`/api/m/attendance/${employeeId}/${date}`), [employeeId, date], ["attendance"]);
  const [status, setStatus] = useState("PRESENT");
  const [statusReason, setStatusReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  // Bumped after a save so the "Mark attendance" form starts fresh (and no longer counts as unsaved).
  const [markRound, setMarkRound] = useState(0);

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
      {embedded ? <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>{data.employee.name}</Text> : <Stack.Screen options={{ title: data.employee.name }} />}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 17, fontWeight: "600", color: C.text }}>{dateLabel(data.date)}</Text>
        <Badge label={data.statusLabel || "—"} tone={statusTone(data.status)} />
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
                  onPress={async () => { if (await dialog.confirm({ title: "Remove this punch?", message: "It stays in history.", confirmText: "Remove", danger: true })) void run("voidPunch", { punchId: p.id }); }}
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
          <MarkAttendance key={`${data.hours?.open}-${data.hours?.close}-${markRound}`} hours={data.hours ?? { open: "09:00", close: "18:00" }} busy={busy === "markAttendance"} onSave={(body) => run("markAttendance", { employeeId, date, ...body }, () => setMarkRound((n) => n + 1))} />
          <Card>
            <H2>Set day status</H2>
            <Muted>For leave, absent or half day. This overrides scans and scheduled leave for this day. To record working times, use Mark attendance above.</Muted>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {STATUSES.map((s) => (
                <Pressable key={s.value} onPress={() => setStatus(s.value)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: status === s.value ? C.text : C.line, backgroundColor: status === s.value ? C.text : C.white }}>
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
