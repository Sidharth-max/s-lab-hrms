import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { ChevronDown, ChevronUp, UserPlus } from "@/components/icons";
import { Badge, Button, Card, ErrorView, Field, Loading, Muted, Notice, Screen, Toggle } from "@/components/ui";
import { api } from "@/lib/api";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { useUnsavedGuard } from "@/lib/unsaved";

interface Manager { id: string; name: string; phone: string; active: boolean; permissions: string[]; siteIds: string[] }
interface Team {
  owners: { name: string; phone: string }[];
  managers: Manager[];
  permissions: { key: string; label: string }[];
  groups?: { title: string; items: { key: string; label: string }[] }[];
  sites: { id: string; name: string }[];
}

function ManagerForm({ team, m, onSave, busy }: { team: Team; m?: Manager; onSave: (body: Record<string, unknown>) => void; busy: boolean }) {
  const [name, setName] = useState(m?.name ?? "");
  const [phone, setPhone] = useState(m?.phone ?? "");
  const [perms, setPerms] = useState<string[]>(m?.permissions ?? []);
  const [sites, setSites] = useState<string[]>(m?.siteIds ?? []);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const same = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
  useUnsavedGuard(!busy && (name !== (m?.name ?? "") || phone !== (m?.phone ?? "") || !same(perms, m?.permissions ?? []) || !same(sites, m?.siteIds ?? [])));
  return (
    <View style={{ gap: 10 }}>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Mobile (used to log in)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Can do</Text>
      {(team.groups ?? [{ title: "", items: team.permissions }]).map((g) => (
        <View key={g.title} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, gap: 10 }}>
          {g.title ? <Text style={{ fontSize: 12, fontWeight: "600", color: C.muted, letterSpacing: 0.4 }}>{g.title.toUpperCase()}</Text> : null}
          {g.items.map((p) => (
            <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ flex: 1, color: C.text, fontSize: 14 }}>{p.label}</Text>
              <Toggle value={perms.includes(p.key)} onValueChange={() => setPerms((x) => toggle(x, p.key))} label={p.label} />
            </View>
          ))}
        </View>
      ))}
      <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Sites (none selected = all sites)</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {team.sites.map((s) => {
          const on = sites.includes(s.id);
          return (
            <Pressable key={s.id} onPress={() => setSites((x) => toggle(x, s.id))} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? C.text : C.line, backgroundColor: on ? C.text : C.white }}>
              <Text style={{ color: on ? C.white : C.text }}>{s.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Button title={m ? "Save" : "Add manager"} loading={busy} disabled={!name.trim() || phone.replace(/\D/g, "").length < 10} onPress={() => onSave({ ...(m ? { id: m.id } : {}), name, phone, permissions: perms, siteIds: sites })} />
    </View>
  );
}

export default function TeamScreen() {
  const { data, error, refreshing, reload } = useLoad(() => api.get<Team>("/api/m/team"), [], ["settings"]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function run(key: string, action: string, body: Record<string, unknown>) {
    setBusy(key);
    setMsg(null);
    try {
      const r = await api.action(action, body);
      setMsg({ text: r.message ?? "Saved", ok: true });
      setOpen(null);
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
      <Stack.Screen options={{ title: "Managers" }} />
      <Muted>Owner (full control, approves by OTP): {data.owners.map((o) => `${o.name} (${o.phone})`).join(", ")}</Muted>
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}
      <Card>
        <Pressable onPress={() => setOpen(open === "new" ? null : "new")} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <UserPlus size={18} color={C.text} />
          <Text style={{ flex: 1, fontWeight: "600", color: C.text, fontSize: 15 }}>Add manager</Text>
          {open === "new" ? <ChevronUp size={18} color={C.muted} /> : <ChevronDown size={18} color={C.muted} />}
        </Pressable>
        {open === "new" ? <ManagerForm team={data} busy={busy === "new"} onSave={(b) => run("new", "saveManager", b)} /> : null}
      </Card>
      {data.managers.map((m) => (
        <Card key={m.id}>
          <Pressable onPress={() => setOpen(open === m.id ? null : m.id)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", color: C.text, fontSize: 15 }}>{m.name}</Text>
              <Muted>{m.phone} · {m.permissions.length === data.permissions.length ? "Full access" : `${m.permissions.length} permissions`}</Muted>
            </View>
            {!m.active ? <Badge label="Disabled" /> : null}
            {open === m.id ? <ChevronUp size={18} color={C.muted} /> : <ChevronDown size={18} color={C.muted} />}
          </Pressable>
          {open === m.id ? (
            <>
              <ManagerForm team={data} m={m} busy={busy === m.id} onSave={(b) => run(m.id, "saveManager", b)} />
              <Button title={m.active ? "Disable login" : "Enable login"} variant={m.active ? "danger" : "secondary"} loading={busy === m.id + "t"} onPress={() => run(m.id + "t", "toggleManager", { id: m.id })} />
            </>
          ) : null}
        </Card>
      ))}
      {data.managers.length === 0 ? <Muted>No managers yet.</Muted> : null}
    </Screen>
  );
}
