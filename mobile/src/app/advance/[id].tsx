import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Button, Card, ErrorView, Field, Hero, Loading, Muted, Notice, Screen, SectionHead } from "@/components/ui";
import { Pencil } from "@/components/icons";
import { C } from "@/lib/theme";
import { DateField } from "@/components/pickers";
import { api } from "@/lib/api";
import { dateLabel, rs } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { useDialog } from "@/components/dialog";
import { useUnsavedGuard } from "@/lib/unsaved";

interface Adv { id: string; employeeId: string; employee: string; code: string; amount: number; givenOn: string; note: string | null; status: string }

const STATUS: Record<string, string> = { ACTIVE: "Given", CLEARED: "Given", PENDING_APPROVAL: "Waiting approval", REJECTED: "Rejected", CANCELLED: "Cancelled" };

function today() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

function EditForm({ a, onSaved }: { a: Adv; onSaved: (msg: string) => void }) {
  const dialog = useDialog();
  const [amount, setAmount] = useState(String(a.amount / 100));
  const [givenOn, setGivenOn] = useState(a.givenOn);
  const [note, setNote] = useState(a.note ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const changed = amount !== String(a.amount / 100) || givenOn !== a.givenOn || note !== (a.note ?? "");
  useUnsavedGuard(changed && !busy);

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
      <SectionHead icon={<Pencil size={18} color={C.ink.orange} />} ink="orange" title="Change advance" />
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <DateField label="Given on" value={givenOn} onChange={setGivenOn} max={today()} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. medical…" />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button title="Save changes" loading={busy === "save"} disabled={!amount} onPress={() => send({ amount, givenOn, note }, "save")} />
      <Button
        title="Cancel this advance"
        variant="danger"
        loading={busy === "cancel"}
        onPress={async () => { if (await dialog.confirm({ title: "Cancel this advance?", message: "It is added back to the salary balance.", cancelText: "Keep", confirmText: "Cancel advance", danger: true })) void send({ cancel: "1" }, "cancel"); }}
      />
    </Card>
  );
}

export default function AdvanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad(() => api.get<{ advance: Adv; canEdit: boolean }>(`/api/m/advances/${id}`), [id], ["advance", "salary"]);
  const [msg, setMsg] = useState<string | null>(null);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const a = data.advance;
  return (
    <Screen>
      <Stack.Screen options={{ title: `Advance · ${a.employee}` }} />
      {msg ? <Notice tone="green" text={msg} /> : null}
      <Hero
        avatar={a.employee}
        eyebrow={`Advance · ${a.code}`}
        title={a.employee}
        subtitle={a.note ?? undefined}
        pills={[{ label: STATUS[a.status] ?? a.status, tone: a.status === "ACTIVE" || a.status === "CLEARED" ? "ok" : "alert" }]}
        valueLabel="Amount"
        value={rs(a.amount)}
        stats={[{ label: "Given on", value: dateLabel(a.givenOn) }]}
      />
      <Muted>An advance comes off the salary balance straight away.</Muted>
      {data.canEdit ? <EditForm key={`${a.amount}-${a.givenOn}-${a.note}`} a={a} onSaved={(m) => { setMsg(m); void reload(); }} /> : <Muted>Only the owner can change an advance.</Muted>}
      <Button title="Open employee" variant="secondary" onPress={() => router.push({ pathname: "/employee/[id]", params: { id: a.employeeId } })} />
    </Screen>
  );
}
