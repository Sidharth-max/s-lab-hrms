import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Button, Card, Field, H2, Muted, Notice, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { deviceInfo } from "@/lib/device-info";
import { C } from "@/lib/theme";

export default function ScannerSetup() {
  const { me, scannerMode, enterScanner, leaveScanner, signOut } = useAuth();
  const sites = me?.sites ?? [];
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Face scanner" }} />
      {scannerMode ? (
        <Card>
          <H2>This device is a scanner</H2>
          <Muted>Log out to show only the face scan screen to workers.</Muted>
          <Button title="Log out and open scanner" onPress={async () => { await signOut(); router.replace("/scanner"); }} />
          <Button
            title="Stop using as scanner"
            variant="secondary"
            onPress={() => Alert.alert("Stop using this device as scanner?", undefined, [{ text: "Cancel" }, { text: "Stop", style: "destructive", onPress: async () => { await leaveScanner(); router.back(); } }])}
          />
        </Card>
      ) : (
        <Card>
          <H2>Use this device as the face scanner</H2>
          <Muted>Workers will then only see the face scan screen. You log out after setting it up. If this device was a scanner before, its old entry is reused, not duplicated.</Muted>
          <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Site</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {sites.map((s) => (
              <Pressable key={s.id} onPress={() => setSiteId(s.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: siteId === s.id ? C.text : C.line, backgroundColor: siteId === s.id ? C.text : C.white }}>
                <Text style={{ color: siteId === s.id ? C.white : C.text }}>{s.name}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Device name" value={name} onChangeText={setName} placeholder="e.g. Gate tablet" />
          {error ? <Notice tone="red" text={error} /> : null}
          <Button
            title="Make this device a scanner"
            loading={busy}
            disabled={!siteId}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await api.post<{ deviceToken: string }>("/api/m/devices/register", { siteId, name, ...deviceInfo() });
                await enterScanner(r.deviceToken);
                await signOut();
                router.replace("/scanner");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      )}
    </Screen>
  );
}
