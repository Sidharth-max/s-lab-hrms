import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { Badge, Button, Card, ErrorView, Loading, Muted, Notice, Screen } from "@/components/ui";
import { GiveAdvanceForm } from "@/components/GiveAdvanceForm";
import { HandCoins } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { dateLabel, monthLabel, rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Adv { id: string; employeeId: string; employee: string; givenOn: string; amount: number; recovered: number; remaining: number; recoveryMonths: number; startMonth: string; status: string }

interface Emp { id: string; name: string; code: string; site: string; active: boolean }

export default function AdvancesScreen() {
  const { can } = useAuth();
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ advances: Adv[] }>("/api/m/advances"), [], ["advance", "approval", "payroll"]);
  const emps = useLoad(() => api.get<{ employees: Emp[] }>("/api/m/employees"), [], ["employee"]);
  const [giving, setGiving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const total = data.advances.filter((a) => a.status === "ACTIVE").reduce((s, a) => s + a.remaining, 0);
  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Stack.Screen options={{ title: "Advances" }} />
      <Muted>Still to recover: {rs(total)}.</Muted>
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
          <Button title="Give advance" icon={<HandCoins size={18} color={C.white} />} onPress={() => { setMsg(null); setGiving(true); }} />
        )
      ) : null}
      <Card style={{ padding: 0, gap: 0 }}>
        {data.advances.length === 0 ? <View style={{ padding: 16 }}><Muted>No open advances.</Muted></View> : null}
        {data.advances.map((a, i) => (
          <Pressable key={a.id} onPress={() => router.push({ pathname: "/advance/[id]", params: { id: a.id } })} style={{ padding: 14, gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "600", color: C.text }}>{a.employee}</Text>
              <Text style={{ fontWeight: "700", color: C.text }}>{rs(a.remaining)}</Text>
            </View>
            <Muted>{dateLabel(a.givenOn)} · {rs(a.amount)} · {a.recoveryMonths === 1 ? "full" : `${a.recoveryMonths} months`} from {monthLabel(a.startMonth)}</Muted>
            {a.status === "PENDING_APPROVAL" ? <Badge label="Waiting approval" tone="red" /> : null}
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
