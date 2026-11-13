import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "@/components/Text";
import { Badge, Button, Card, ErrorView, Field, H2, Loading, Muted, Notice, Row, Screen, Segmented } from "@/components/ui";
import { DateField, MonthField } from "@/components/pickers";
import { api } from "@/lib/api";
import { dateLabel, monthLabel, rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { useDialog } from "@/components/dialog";

interface Adv {
  id: string; employeeId: string; employee: string; code: string; amount: number; givenOn: string; recoveryMonths: number;
  startMonth: string; note: string | null; status: string; recovered: number; remaining: number;
}

const STATUS: Record<string, string> = { ACTIVE: "Recovering", CLEARED: "Cleared", PENDING_APPROVAL: "Waiting approval", REJECTED: "Rejected", CANCELLED: "Cancelled" };
const PLANS = ["1", "2", "3", "4", "6", "12"];

function today() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

function EditForm({ a, onSaved }: { a: Adv; onSaved: (msg: string) => void }) {
  const dialog = useDialog();
  const [amount, setAmount] = useState(String(a.amount / 100));
  const [givenOn, setGivenOn] = useState(a.givenOn);
  const [months, setMonths] = useState(String(a.recoveryMonths));
  const [startMonth, setStartMonth] = useState(a.startMonth);
  const [note, setNote] = useState(a.note ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = a.recovered > 0;

  async function send(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const r = await api.action("editAdvance", { advanceId: a.id, ...body });
      onSaved(r.message ?? "Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <H2>Change advance</H2>
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" hint={started ? `At least ${rs(a.recovered)} (already recovered)` : undefined} />
      <DateField label="Given on" value={givenOn} onChange={setGivenOn} max={today()} />
      <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Recover over (months)</Text>
      <Segmented options={(PLANS.includes(months) ? PLANS : [...PLANS, months]).map((m) => ({ value: m, label: m === "1" ? "Full" : `${m} m` }))} value={months} onChange={setMonths} />
      {started ? <Muted>Recovery started in {monthLabel(a.startMonth)}, so the start month stays.</Muted> : <MonthField label="First recovery month" value={startMonth} onChange={setStartMonth} />}
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button title="Save changes" loading={busy === "save"} disabled={!amount} onPress={() => send({ amount, givenOn, recoveryMonths: months, ...(started ? {} : { startMonth }), note }, "save")} />
      {!started ? (
        <Button
          title="Cancel this advance"
          variant="danger"
          loading={busy === "cancel"}
          onPress={async () => { if (await dialog.confirm({ title: "Cancel this advance?", message: "It will no longer be recovered from salary.", cancelText: "Keep", confirmText: "Cancel advance", danger: true })) void send({ cancel: "1" }, "cancel"); }}
        />
      ) : null}
    </Card>
  );
}

export default function AdvanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad(() => api.get<{ advance: Adv; canEdit: boolean }>(`/api/m/advances/${id}`), [id], ["advance", "payroll"]);
  const [msg, setMsg] = useState<string | null>(null);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const a = data.advance;
  return (
    <Screen>
      <Stack.Screen options={{ title: `Advance · ${a.employee}` }} />
      {msg ? <Notice tone="green" text={msg} /> : null}
      <Card>
        <Row label="Employee" value={`${a.employee} (${a.code})`} />
        <Row label="Given on" value={dateLabel(a.givenOn)} />
        <Row label="Amount" value={rs(a.amount)} />
        <Row label="Recovered" value={rs(a.recovered)} />
        <Row label="Still to recover" value={rs(Math.max(0, a.remaining))} strong />
        <Row label="Plan" value={`${a.recoveryMonths === 1 ? "Full" : `${a.recoveryMonths} months`} from ${monthLabel(a.startMonth)}`} />
        <Row label="Status" value={<Badge label={STATUS[a.status] ?? a.status} tone={a.status === "ACTIVE" ? "neutral" : a.status === "CLEARED" ? "green" : "red"} />} />
        {a.note ? <Muted>{a.note}</Muted> : null}
      </Card>
      {data.canEdit ? <EditForm key={`${a.amount}-${a.givenOn}-${a.recoveryMonths}-${a.startMonth}-${a.note}`} a={a} onSaved={(m) => { setMsg(m); void reload(); }} /> : <Muted>Only the owner can change an advance.</Muted>}
      <Button title="Open employee" variant="secondary" onPress={() => router.push({ pathname: "/employee/[id]", params: { id: a.employeeId } })} />
    </Screen>
  );
}
