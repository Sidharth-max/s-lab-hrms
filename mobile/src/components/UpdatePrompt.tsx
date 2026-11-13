import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Linking, Modal, Text, View } from "react-native";
import { Button, Muted } from "./ui";
import { API_URL } from "@/lib/api";
import { C } from "@/lib/theme";

/** Asks the server for the newest APK; if newer than this app, offers the download. */
export function UpdatePrompt() {
  const [update, setUpdate] = useState<{ name: string; url: string } | null>(null);
  useEffect(() => {
    const current = Number((Constants.expoConfig?.extra as { versionCode?: number } | undefined)?.versionCode ?? 0);
    fetch(`${API_URL}/api/app-version`)
      .then((r) => r.json())
      .then((d: { latest?: { versionCode: number; versionName: string } | null; apkUrl?: string }) => {
        if (d.latest && d.apkUrl && d.latest.versionCode > current) setUpdate({ name: d.latest.versionName, url: d.apkUrl });
      })
      .catch(() => {});
  }, []);
  if (!update) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setUpdate(null)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: C.white, borderRadius: 12, padding: 20, gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>There is a new update</Text>
          <Muted>Version {update.name}. Download it and install.</Muted>
          <Button title="Download update" onPress={() => Linking.openURL(update.url)} />
          <Button title="Later" variant="secondary" onPress={() => setUpdate(null)} />
        </View>
      </View>
    </Modal>
  );
}
