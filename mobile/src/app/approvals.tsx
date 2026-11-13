import { Stack } from "expo-router";
import { useState } from "react";
import { RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { Button, Card, ErrorView, Field, Hero, IconChip, Loading, Muted, Notice, Screen } from "@/components/ui";
import { BadgeCheck, CircleCheck, HandCoins } from "@/components/icons";
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
      <Hero
        icon={<BadgeCheck size={24} color="#ffffff" />}
        eyebrow="Approvals"
        title={data.pending.length ? `${data.pending.length} waiting` : "All clear"}
        subtitle="An advance that makes a balance negative needs approval: here, or by an OTP sent to the owner's mobile."
        pills={[{ label: data.canDecide ? "You can approve" : "Needs the owner's OTP", tone: data.canDecide ? "ok" : undefined }]}
      />
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}
      {data.pending.length === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: 28 }}>
          <IconChip ink="green" size={52}><CircleCheck size={26} color={C.ink.green} /></IconChip>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>Nothing waiting</Text>
          <Muted>New requests show up here.</Muted>
        </Card>
      ) : null}
      {data.pending.map((p) => (
        <Card key={p.id}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <IconChip ink="orange" size={40}><HandCoins size={20} color={C.ink.orange} /></IconChip>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: "700", fontSize: 15, color: C.text }}>{p.summary}</Text>
              <Muted>Asked by {p.requestedBy ?? "?"}</Muted>
            </View>
          </View>
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
