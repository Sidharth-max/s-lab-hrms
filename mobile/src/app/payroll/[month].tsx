import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { Badge, Button, Card, ErrorView, Field, Loading, Muted, Notice, Row, Screen, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { monthLabel, rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { useDialog } from "@/components/dialog";

interface Line { id: string; employeeId: string; name: string; wageType: string; rate: number; payableDays: number; daysInMonth: number; gross: number; adjustments: number; pf: number; esi: number; advance: number; net: number; paid: number; paymentMode: string | null; hold?: boolean }
interface Month { employees: { id: string; name: string; code: string }[]; adjustments: { id: string; employee: string; amount: number; reason: string }[]; month: string; exists: boolean; locked: boolean; updatedAt: string | null; canRun: boolean; canLock: boolean; lines: Line[] }

export default function PayrollMonth() {
  const dialog = useDialog();
  const { month } = useLocalSearchParams<{ month: string }>();
  const { data, error, refreshing, reload } = useLoad(() => api.get<Month>(`/api/m/payroll/${month}`), [month], ["payroll", "attendance", "advance", "employee"]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("CASH");
  const [adjEmp, setAdjEmp] = useState("");
  const [adjKind, setAdjKind] = useState<"add" | "deduct">("add");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");

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
          onPress={async () => { if (await dialog.confirm({ title: `Lock ${monthLabel(data.month)}?`, message: "Attendance for this month can then no longer be edited.", confirmText: "Lock" })) void run("lock", "lockPayroll", { month: data.month }); }}
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
          <Muted>{l.paid ? `Paid ${rs(l.paid)} ${l.paymentMode ?? ""}` : l.hold ? "On hold: pay later from the employee's Salary tab" : "Not paid"}</Muted>
          <Button title="Payslip" variant="secondary" onPress={() => router.push({ pathname: "/payslip/[lineId]", params: { lineId: l.id } })} />
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

      {data.canRun ? (
        <Card>
          <Text style={{ fontWeight: "600", fontSize: 15, color: C.text }}>Adjustments for {monthLabel(data.month)}</Text>
          <Muted>One-off extra payment or deduction, e.g. a bonus or a fix for a locked month.</Muted>
          {data.locked ? (
            <Muted>This month is locked. Add adjustments to next month.</Muted>
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {data.employees.map((e) => (
                  <Pressable key={e.id} onPress={() => setAdjEmp(e.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: adjEmp === e.id ? C.text : C.line, backgroundColor: adjEmp === e.id ? C.text : C.white }}>
                    <Text style={{ color: adjEmp === e.id ? C.white : C.text }}>{e.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Segmented options={[{ value: "add", label: "Add (+)" }, { value: "deduct", label: "Deduct (−)" }]} value={adjKind} onChange={setAdjKind} />
              <Field label="Amount (₹)" value={adjAmount} onChangeText={setAdjAmount} keyboardType="decimal-pad" />
              <Field label="Reason" value={adjReason} onChangeText={setAdjReason} />
              <Button
                title="Add adjustment"
                loading={busy === "adj"}
                disabled={!adjEmp || !adjAmount || adjReason.trim().length < 3}
                onPress={() => run("adj", "addAdjustment", { month: data.month, employeeId: adjEmp, kind: adjKind, amount: adjAmount, reason: adjReason }, () => { setAdjAmount(""); setAdjReason(""); })}
              />
            </>
          )}
          {data.adjustments.map((a) => (
            <Row key={a.id} label={`${a.employee} · ${a.reason}`} value={rs(a.amount)} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
