import { Stack } from "expo-router";
import { useState } from "react";
import { RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { Button, Card, ErrorView, Field, Loading, Muted, Notice, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Approvals { canDecide: boolean; pending: { id: string; summary: string; requestedBy: string | null; at: string }[] }

export default function ApprovalsScreen() {
  const { refresh } = useAuth();
  const { data, error, refreshing, reload } = useLoad(() => api.get<Approvals>("/api/m/approvals"), [], ["approval", "advance"]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function run(key: string, name: string, body: Record<string, unknown>) {
    setBusy(key);
    setMsg(null);
    try {
      const r = await api.action(name, body);
      setMsg({ text: r.message ?? "Done", ok: true });
      await Promise.all([reload(), refresh()]);
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
      <Stack.Screen options={{ title: "Approvals" }} />
      <Muted>{"An advance that makes a balance negative needs the owner's approval: here, or by an OTP sent to the owner's mobile."}</Muted>
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}
      {data.pending.length === 0 ? <Card><Muted>Nothing waiting.</Muted></Card> : null}
      {data.pending.map((p) => (
        <Card key={p.id}>
          <Text style={{ fontWeight: "600", fontSize: 15, color: C.text }}>{p.summary}</Text>
          <Muted>Asked by {p.requestedBy ?? "?"}</Muted>
          {data.canDecide ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button style={{ flex: 1 }} title="Approve" loading={busy === p.id + "a"} onPress={() => run(p.id + "a", "decideApproval", { approvalId: p.id, decision: "approve" })} />
              <Button style={{ flex: 1 }} title="Reject" variant="danger" loading={busy === p.id + "r"} onPress={() => run(p.id + "r", "decideApproval", { approvalId: p.id, decision: "reject" })} />
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <Button title="Send OTP to owner" variant="secondary" loading={busy === p.id + "s"} onPress={() => run(p.id + "s", "sendApprovalOtp", { approvalId: p.id })} />
              <Field label="OTP the owner tells you" value={codes[p.id] ?? ""} onChangeText={(t) => setCodes((c) => ({ ...c, [p.id]: t }))} keyboardType="number-pad" maxLength={6} />
              <Button title="Approve with OTP" loading={busy === p.id + "v"} disabled={(codes[p.id] ?? "").length !== 6} onPress={() => run(p.id + "v", "verifyApprovalOtp", { approvalId: p.id, code: codes[p.id] })} />
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}
