import { router, Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/Text";
import { Button, Card, ChoiceChip, Field, Hero, Muted, Notice, Screen } from "@/components/ui";
import { ScanFace } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { deviceInfo } from "@/lib/device-info";
import { C } from "@/lib/theme";
import { useDialog } from "@/components/dialog";

export default function ScannerSetup() {
  const dialog = useDialog();
  const { me, scannerMode, enterScanner, leaveScanner, signOut } = useAuth();
  const sites = me?.sites ?? [];
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Face scanner" }} />
      <Hero
        icon={<ScanFace size={24} color="#ffffff" />}
        eyebrow="Face scanner"
        title={scannerMode ? "This device is a scanner" : "Use this device as the face scanner"}
        subtitle={scannerMode ? "Log out to show only the face scan screen to workers." : "Workers then only see the face scan screen. If this device was a scanner before, its old entry is reused."}
      />
      {scannerMode ? (
        <Card>
          <Button title="Log out and open scanner" onPress={async () => { await signOut(); router.replace("/scanner"); }} />
          <Button
            title="Stop using as scanner"
            variant="secondary"
            onPress={async () => { if (await dialog.confirm({ title: "Stop using this device as scanner?", confirmText: "Stop", danger: true })) { await leaveScanner(); router.back(); } }}
          />
        </Card>
      ) : (
        <Card>
          <Muted>You log out after setting it up.</Muted>
          <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Site</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {sites.map((s) => (
              <ChoiceChip key={s.id} label={s.name} selected={siteId === s.id} onPress={() => setSiteId(s.id)} />
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
