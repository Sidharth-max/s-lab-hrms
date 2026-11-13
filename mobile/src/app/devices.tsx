import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, RefreshControl, Text, View } from "react-native";
import { ScanFace } from "lucide-react-native";
import { Badge, Button, Card, ErrorView, Loading, Muted, Notice, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Device { id: string; name: string; site: string; registeredBy: string; createdAt: string; lastSeenAt: string | null; revoked: boolean }

export default function DevicesScreen() {
  const { scannerMode } = useAuth();
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ devices: Device[] }>("/api/m/devices"), [], ["device", "attendance"]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Stack.Screen options={{ title: "Scanner devices" }} />
      <Button title={scannerMode ? "This device is a scanner" : "Use this device as face scanner"} icon={<ScanFace size={18} color={C.white} />} onPress={() => router.push("/scanner-setup")} />
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}
      {data.devices.length === 0 ? <Card><Muted>No scanners yet.</Muted></Card> : null}
      {data.devices.map((d) => (
        <Card key={d.id} style={d.revoked ? { opacity: 0.6 } : undefined}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontWeight: "600", color: C.text, fontSize: 15 }}>{d.name}</Text>
            {d.revoked ? <Badge label="Removed" /> : <Badge label="Active" tone="green" />}
          </View>
          <Muted>{d.site} · added by {d.registeredBy}</Muted>
          <Muted>Last scan: {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString("en-IN") : "never"}</Muted>
          {!d.revoked ? (
            <Button
              title="Remove scanner"
              variant="danger"
              loading={busy === d.id}
              onPress={() =>
                Alert.alert("Remove this scanner?", "It will stop working immediately.", [
                  { text: "Cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                      setBusy(d.id);
                      try {
                        const r = await api.action("revokeDevice", { deviceId: d.id });
                        setMsg({ text: r.message ?? "Removed", ok: true });
                        await reload();
                      } catch (e) {
                        setMsg({ text: (e as Error).message, ok: false });
                      } finally {
                        setBusy(null);
                      }
                    },
                  },
                ])
              }
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
