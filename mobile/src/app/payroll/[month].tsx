import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, RefreshControl, Text, View } from "react-native";
import { Badge, Button, Card, ErrorView, Field, Loading, Muted, Notice, Row, Screen, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { monthLabel, rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Line { id: string; employeeId: string; name: string; wageType: string; rate: number; payableDays: number; daysInMonth: number; gross: number; adjustments: number; pf: number; esi: number; advance: number; net: number; paid: number; paymentMode: string | null }
interface Month { month: string; exists: boolean; locked: boolean; updatedAt: string | null; canRun: boolean; canLock: boolean; lines: Line[] }

export default function PayrollMonth() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const { data, error, refreshing, reload } = useLoad(() => api.get<Month>(`/api/m/payroll/${month}`), [month]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("CASH");

  async function run(key: string, name: string, body: Record<string, unknown>, after?: () => void) {
    setBusy(key);
    setMsg(null);
    try {
      const r = await api.action(name, body);
      setMsg({ text: r.message ?? "Done", ok: true });
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
  const sum = (k: keyof Line) => data.lines.reduce((s, l) => s + (l[k] as number), 0);

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Stack.Screen options={{ title: `Salary · ${monthLabel(data.month)}` }} />
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        {data.exists ? <Badge label={data.locked ? "Locked" : "Draft"} tone={data.locked ? "green" : "neutral"} /> : <Muted>Not calculated yet.</Muted>}
      </View>
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}
      {!data.locked && data.canRun ? (
        <Button title={data.exists ? "Recalculate" : "Calculate salary"} variant={data.exists ? "secondary" : "primary"} loading={busy === "recalc"} onPress={() => run("recalc", "recalcPayroll", { month: data.month })} />
      ) : null}
      {data.exists && !data.locked && data.canLock ? (
        <Button
          title="Approve and lock"
          loading={busy === "lock"}
          onPress={() => Alert.alert(`Lock ${monthLabel(data.month)}?`, "Attendance for this month can then no longer be edited.", [{ text: "Cancel" }, { text: "Lock", onPress: () => run("lock", "lockPayroll", { month: data.month }) }])}
        />
      ) : null}
      {data.exists ? (
        <Card>
          <Row label="Gross" value={rs(sum("gross"))} />
          <Row label="PF + ESIC (employee)" value={rs(sum("pf") + sum("esi"))} />
          <Row label="Advance recovered" value={rs(sum("advance"))} />
          <Row label="Net to pay" value={rs(sum("net"))} strong />
        </Card>
      ) : null}
      {data.lines.map((l) => (
        <Card key={l.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "600", fontSize: 15, color: C.text }}>{l.name}</Text>
            <Text style={{ fontWeight: "700", fontSize: 15, color: l.net < 0 ? C.red : C.text }}>{rs(l.net)}</Text>
          </View>
          <Muted>
            {rs(l.rate)}{l.wageType === "MONTHLY" ? "/m" : "/d"} · {l.payableDays}{l.wageType === "MONTHLY" ? ` of ${l.daysInMonth}` : ""} days · gross {rs(l.gross)}
            {l.pf ? ` · PF ${rs(l.pf)}` : ""}{l.esi ? ` · ESIC ${rs(l.esi)}` : ""}{l.advance ? ` · advance ${rs(l.advance)}` : ""}{l.adjustments ? ` · adj ${rs(l.adjustments)}` : ""}
          </Muted>
          <Muted>{l.paid ? `Paid ${rs(l.paid)} ${l.paymentMode ?? ""}` : "Not paid"}</Muted>
          {data.locked && data.canLock ? (
            payFor === l.id ? (
              <View style={{ gap: 8 }}>
                <Field label="Amount paid (₹)" value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" />
                <Segmented options={[{ value: "CASH", label: "Cash" }, { value: "BANK", label: "Bank" }, { value: "UPI", label: "UPI" }, { value: "CHEQUE", label: "Cheque" }]} value={payMode} onChange={setPayMode} />
                <Button title="Save payment" loading={busy === l.id} onPress={() => run(l.id, "recordPayment", { lineId: l.id, amount: payAmount, mode: payMode }, () => setPayFor(null))} />
              </View>
            ) : (
              <Button title={l.paid ? "Edit payment" : "Record payment"} variant="secondary" onPress={() => { setPayFor(l.id); setPayAmount(String(Math.max(0, l.paid || l.net) / 100)); }} />
            )
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
