import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { Pencil, ScanFace, Smartphone } from "@/components/icons";
import { Badge, Button, Card, ChoiceChip, ErrorView, Field, Hero, IconChip, Loading, Muted, Notice, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { useDialog } from "@/components/dialog";

interface Device { id: string; name: string; site: string; siteId: string; model: string | null; registeredBy: string; createdAt: string; lastSeenAt: string | null; revoked: boolean }

function SitePicker({ sites, value, onChange }: { sites: { id: string; name: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {sites.map((s) => (
        <ChoiceChip key={s.id} label={s.name} selected={value === s.id} onPress={() => onChange(s.id)} />
      ))}
    </View>
  );
}

function DeviceCard({ d, sites, onDone }: { d: Device; sites: { id: string; name: string }[]; onDone: (msg: { text: string; ok: boolean }) => Promise<void> }) {
  const dialog = useDialog();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(d.name);
  const [siteId, setSiteId] = useState(d.siteId);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: string, body: Record<string, unknown>) {
    setBusy(action);
    try {
      const r = await api.action(action, body);
      setEditing(false);
      await onDone({ text: r.message ?? "Saved", ok: true });
    } catch (e) {
      await onDone({ text: (e as Error).message, ok: false });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={d.revoked ? { opacity: 0.6 } : undefined}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <IconChip ink={d.revoked ? "red" : "blue"} size={40}><Smartphone size={20} color={d.revoked ? C.ink.red : C.ink.blue} /></IconChip>
        <Text style={{ flex: 1, fontWeight: "700", color: C.text, fontSize: 15 }}>{d.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {d.revoked ? <Badge label="Removed" /> : <Badge label="Active" tone="green" />}
          {!d.revoked ? (
            <Pressable onPress={() => setEditing((x) => !x)} hitSlop={10} accessibilityLabel="Rename scanner">
              <Pencil size={18} color={C.text} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <Muted>{d.site}{d.model ? ` · ${d.model}` : ""}</Muted>
      <Muted>Added by {d.registeredBy} on {new Date(d.createdAt).toLocaleDateString("en-IN")} · Last scan: {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString("en-IN") : "never"}</Muted>
      {editing ? (
        <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
          <Field label="Name" value={name} onChangeText={setName} maxLength={60} />
          <SitePicker sites={sites} value={siteId} onChange={setSiteId} />
          <Button title="Save" loading={busy === "renameDevice"} disabled={!name.trim()} onPress={() => run("renameDevice", { deviceId: d.id, name, siteId })} />
          <Button
            title="Remove scanner"
            variant="danger"
            loading={busy === "revokeDevice"}
            onPress={async () => {
              if (await dialog.confirm({ title: "Remove this scanner?", message: "It will stop working immediately.", confirmText: "Remove", danger: true })) void run("revokeDevice", { deviceId: d.id });
            }}
          />
        </View>
      ) : null}
    </Card>
  );
}

export default function DevicesScreen() {
  const { scannerMode, me } = useAuth();
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ devices: Device[] }>("/api/m/devices"), [], ["device", "attendance"]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const active = data.devices.filter((d) => !d.revoked);
  const done = async (m: { text: string; ok: boolean }) => {
    setMsg(m);
    await reload();
  };
  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Stack.Screen options={{ title: "Scanner devices" }} />
      <Hero
        icon={<Smartphone size={24} color="#ffffff" />}
        eyebrow="Scanner devices"
        title={`${active.length} active scanner${active.length === 1 ? "" : "s"}`}
        subtitle="Phones and tablets that take face attendance."
      />
      <Button title={scannerMode ? "This device is a scanner" : "Use this device as face scanner"} icon={<ScanFace size={18} color="#ffffff" />} onPress={() => router.push("/scanner-setup")} />
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}
      {active.length === 0 ? <Card><Muted>No active scanners.</Muted></Card> : null}
      {active.map((d) => <DeviceCard key={d.id} d={d} sites={me?.sites ?? []} onDone={done} />)}
      {/* Removed scanners are not listed (they stay in History). */}
    </Screen>
  );
}
