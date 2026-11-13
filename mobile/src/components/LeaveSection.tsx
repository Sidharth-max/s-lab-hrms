import { useState } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { CalendarCheck } from "./icons";
import { Badge, Button, Card, Field, Muted, Notice, Segmented } from "./ui";
import { DateField } from "./pickers";
import { Sheet } from "./Sheet";
import { EmployeePicker, type PickEmployee } from "./EmployeePicker";
import { useDialog } from "./dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateLabel } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { useUnsavedGuard } from "@/lib/unsaved";

interface Leave {
  id: string; employeeId: string; employee: string; code: string; from: string; to: string; days: number; paid: boolean;
  reason: string | null; status: string; plannedTo: string | null; state: "upcoming" | "on_leave" | "done" | "cancelled";
}

const STATE: Record<Leave["state"], { label: string; tone: "neutral" | "amber" | "green" | "red" }> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  on_leave: { label: "On leave", tone: "amber" },
  done: { label: "Finished", tone: "green" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

function today() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

/**
 * Schedule leave, in a bottom sheet. Before, "Schedule leave" expanded a form at the top of a long
 * page without scrolling to it, so it looked like nothing happened. A pop-up keeps the person in
 * place and puts the form (and its button) in the thumb zone.
 */
function LeaveSheet({ visible, employeeId: fixedId, employees, onClose, onDone }: { visible: boolean; employeeId?: string; employees?: PickEmployee[]; onClose: () => void; onDone: (m: { text: string; ok: boolean }) => Promise<void> }) {
  const [employeeId, setEmployeeId] = useState(fixedId ?? "");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [paid, setPaid] = useState<"1" | "0">("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useUnsavedGuard(visible && !busy && (!!reason || from !== today() || to !== today()));
  const days = to >= from ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1 : 0;
  const button = (
    <Button
      title={days ? `Schedule ${days} day${days === 1 ? "" : "s"}` : "Schedule leave"}
      icon={<CalendarCheck size={18} color={C.headText} />}
      loading={busy}
      disabled={!employeeId || !days}
      onPress={async () => {
        setBusy(true);
        try {
          const r = await api.action("scheduleLeave", { employeeId, fromDate: from, toDate: to, paid, reason });
          // Start the form fresh so it no longer counts as unsaved.
          setReason("");
          setFrom(today());
          setTo(today());
          await onDone({ text: r.message ?? "Scheduled", ok: true });
        } catch (e) {
          await onDone({ text: (e as Error).message, ok: false });
        } finally {
          setBusy(false);
        }
      }}
    />
  );
  return (
    <Sheet visible={visible} onClose={onClose} title="Schedule leave" footer={button}>
      <Muted>Every working day in the range is marked as leave. If they come back early and scan in, the leave ends the day before by itself.</Muted>
      {!fixedId && employees ? <EmployeePicker employees={employees} value={employeeId} onChange={setEmployeeId} /> : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><DateField label="First day" value={from} onChange={(d) => { setFrom(d); if (to < d) setTo(d); }} /></View>
        <View style={{ flex: 1 }}><DateField label="Last day" value={to} onChange={setTo} min={from} /></View>
      </View>
      <Segmented options={[{ value: "1", label: "Paid leave" }, { value: "0", label: "Unpaid leave" }]} value={paid} onChange={setPaid} />
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. family function…" />
    </Sheet>
  );
}

function LeaveCard({ l, showName, canEdit, onDone }: { l: Leave; showName: boolean; canEdit: boolean; onDone: (m: { text: string; ok: boolean }) => Promise<void> }) {
  const dialog = useDialog();
  const [ending, setEnding] = useState(false);
  const [back, setBack] = useState(today() > l.from ? today() : l.from);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (name: string, body: Record<string, unknown>) => {
    setBusy(name);
    try {
      const r = await api.action(name, body);
      setEnding(false);
      await onDone({ text: r.message ?? "Saved", ok: true });
    } catch (e) {
      await onDone({ text: (e as Error).message, ok: false });
    } finally {
      setBusy(null);
    }
  };
  const st = STATE[l.state];
  const active = l.status === "ACTIVE" && l.state !== "done";
  return (
    <Card style={l.state === "cancelled" ? { opacity: 0.55 } : undefined}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          {showName ? <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>{l.employee} <Text style={{ color: C.muted, fontWeight: "400" }}>{l.code}</Text></Text> : null}
          <Text style={{ fontSize: 15, fontWeight: showName ? "400" : "600", color: C.text }}>{dateLabel(l.from)} – {dateLabel(l.to)}</Text>
          <Muted>{l.days} day{l.days === 1 ? "" : "s"} · {l.paid ? "Paid" : "Unpaid"}{l.reason ? ` · ${l.reason}` : ""}</Muted>
          {l.plannedTo && l.status === "ACTIVE" ? <Muted>Came back early (was until {dateLabel(l.plannedTo)})</Muted> : null}
        </View>
        <Badge label={st.label} tone={st.tone} />
      </View>
      {canEdit && active ? (
        ending ? (
          <View style={{ gap: 10 }}>
            <DateField label="Came back on" value={back} onChange={setBack} min={l.from} max={l.to} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Button title="Cancel" variant="secondary" onPress={() => setEnding(false)} /></View>
              <View style={{ flex: 1 }}><Button title="End leave" loading={busy === "endLeave"} onPress={() => run("endLeave", { leaveId: l.id, returnDate: back })} /></View>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {l.state === "on_leave" ? <View style={{ flex: 1 }}><Button title="Came back early" variant="secondary" onPress={() => setEnding(true)} /></View> : null}
            <View style={{ flex: 1 }}>
              <Button
                title="Cancel leave"
                variant="secondary"
                loading={busy === "cancelLeave"}
                onPress={async () => {
                  if (await dialog.confirm({ title: "Cancel this leave?", message: "The days go back to normal attendance.", confirmText: "Cancel leave", cancelText: "Keep", danger: true })) void run("cancelLeave", { leaveId: l.id });
                }}
              />
            </View>
          </View>
        )
      ) : null}
    </Card>
  );
}

/** Leaves for one employee (employeeId) or for everyone (employees, for the picker). */
export function LeaveSection({ employeeId, employees, active = true }: { employeeId?: string; employees?: PickEmployee[]; active?: boolean }) {
  const { can } = useAuth();
  const { data, reload } = useLoad(() => api.get<{ leaves: Leave[] }>(`/api/m/leaves${employeeId ? `?employeeId=${employeeId}` : ""}`), [employeeId], ["attendance", "employee"]);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const canEdit = can("attendance.edit");
  const done = async (m: { text: string; ok: boolean }) => {
    setMsg(m);
    if (m.ok) setAdding(false);
    await reload();
  };
  const leaves = data?.leaves ?? [];
  return (
    <View style={{ gap: 12 }}>
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}
      {canEdit && active ? (
        <Button title="Schedule leave" icon={<CalendarCheck size={18} color={C.headText} />} onPress={() => { setMsg(null); setAdding(true); }} />
      ) : null}
      {adding ? <LeaveSheet visible employeeId={employeeId} employees={employees} onClose={() => setAdding(false)} onDone={done} /> : null}
      {data && leaves.length === 0 ? <Card><Muted>No leave scheduled.</Muted></Card> : null}
      {leaves.map((l) => <LeaveCard key={l.id} l={l} showName={!employeeId} canEdit={canEdit} onDone={done} />)}
    </View>
  );
}
