import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { Avatar, Badge, Button, Card, ErrorView, Hero, Loading, Muted, Notice, Screen, SectionHead } from "@/components/ui";
import { GiveAdvanceForm } from "@/components/GiveAdvanceForm";
import { Coins, HandCoins } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { dateLabel, rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Adv { id: string; employeeId: string; employee: string; givenOn: string; amount: number; note: string | null; status: string }

interface Emp { id: string; name: string; code: string; site: string; active: boolean }

export default function AdvancesScreen() {
  const { can } = useAuth();
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ advances: Adv[] }>("/api/m/advances"), [], ["advance", "approval", "salary"]);
  const emps = useLoad(() => api.get<{ employees: Emp[] }>("/api/m/employees"), [], ["employee"]);
  const [giving, setGiving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const live = data.advances.filter((a) => a.status !== "CANCELLED" && a.status !== "REJECTED");
  const total = data.advances.filter((a) => a.status === "ACTIVE").reduce((s, a) => s + a.amount, 0);
  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Stack.Screen options={{ title: "Advances" }} />
      <Hero
        icon={<Coins size={24} color="#ffffff" />}
        eyebrow="Advances"
        title={rs(total)}
        subtitle="Given and not yet recovered. Each one comes off that person's salary balance straight away."
        stats={[
          { label: "Given", value: String(data.advances.filter((a) => a.status === "ACTIVE").length) },
          { label: "Waiting approval", value: String(data.advances.filter((a) => a.status === "PENDING_APPROVAL").length), alert: data.advances.some((a) => a.status === "PENDING_APPROVAL") },
          { label: "Cleared", value: String(data.advances.filter((a) => a.status === "CLEARED").length) },
        ]}
      />
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}
      {can("advances.manage") ? (
        giving ? (
          <>
            <GiveAdvanceForm
              employees={(emps.data?.employees ?? []).filter((e) => e.active)}
              onDone={async (m) => {
                setMsg(m);
                if (m.ok) setGiving(false);
                await reload();
              }}
            />
            <Button title="Cancel" variant="secondary" onPress={() => setGiving(false)} />
          </>
        ) : (
          <Button title="Give advance" icon={<HandCoins size={18} color="#ffffff" />} onPress={() => { setMsg(null); setGiving(true); }} />
        )
      ) : null}
      <Card style={{ padding: 0, gap: 0 }}>
        <View style={{ padding: 14, paddingBottom: 6 }}><SectionHead icon={<HandCoins size={18} color={C.ink.orange} />} ink="orange" title="All advances" /></View>
        {/* Cancelled and rejected advances are not listed (they stay in History). */}
        {live.length === 0 ? <View style={{ padding: 16 }}><Muted>No advances.</Muted></View> : null}
        {live.map((a, i) => (
          <Pressable key={a.id} onPress={() => router.push({ pathname: "/advance/[id]", params: { id: a.id } })} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderTopWidth: 1, borderTopColor: C.hairline, opacity: a.status === "CANCELLED" || a.status === "REJECTED" ? 0.55 : 1, backgroundColor: pressed ? C.soft : "transparent" })}>
            <Avatar name={a.employee} size={40} muted={a.status === "CANCELLED" || a.status === "REJECTED"} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: C.text }} numberOfLines={1}>{a.employee}</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: C.ink.orange, fontVariant: ["tabular-nums"], textDecorationLine: a.status === "CANCELLED" || a.status === "REJECTED" ? "line-through" : "none" }}>{rs(a.amount)}</Text>
              </View>
              <Muted>{dateLabel(a.givenOn)}{a.note ? ` · ${a.note}` : ""}</Muted>
              {a.status === "PENDING_APPROVAL" ? <Badge label="Waiting approval" tone="amber" dot /> : a.status === "CANCELLED" ? <Badge label="Cancelled" /> : a.status === "REJECTED" ? <Badge label="Rejected" /> : null}
            </View>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
