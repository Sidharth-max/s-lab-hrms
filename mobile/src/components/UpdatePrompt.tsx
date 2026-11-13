import { useState } from "react";
import { Modal, View } from "react-native";
import { Text } from "@/components/Text";
import { Download } from "@/components/icons";
import { Button, Muted, Notice } from "./ui";
import { installUpdate, useAppUpdate, useInstallState } from "@/lib/update";
import { C } from "@/lib/theme";

/** Update pop-up: downloads the new APK inside the app, then opens Android's installer. */
export function UpdatePrompt() {
  const found = useAppUpdate();
  const install = useInstallState();
  const update = install.target ?? found;
  const [dismissed, setDismissed] = useState<{ name: string; token: number } | null>(null);
  if (!update) return null;
  const busy = install.phase === "downloading" || install.phase === "installing";
  const hidden = dismissed?.name === update.name && dismissed.token === install.showToken && !busy;
  if (hidden) return null;
  const pct = Math.round(install.progress * 100);
  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent navigationBarTranslucent onRequestClose={() => { if (!busy) setDismissed({ name: update.name, token: install.showToken }); }}>
      <View style={{ flex: 1, backgroundColor: "rgba(10,10,10,0.55)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 20, gap: 12, maxWidth: 420, width: "100%", alignSelf: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" }}>
              <Download size={18} color={C.green} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>New version {update.name}</Text>
          </View>
          {install.phase === "downloading" ? (
            <>
              <Muted>Downloading… {pct}%</Muted>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: C.soft, overflow: "hidden" }}>
                <View style={{ width: `${pct}%`, height: "100%", backgroundColor: C.green }} />
              </View>
            </>
          ) : install.phase === "installing" ? (
            <Muted>Opening the installer. Tap Update there. Your login and data stay.</Muted>
          ) : (
            <Muted>The app downloads the update and opens the installer. Tap Update there. Your login and data stay.</Muted>
          )}
          {install.phase === "error" && install.error ? <Notice tone="red" text={install.error} /> : null}
          {!busy ? (
            <>
              <Button title={install.phase === "error" ? "Try again" : "Update now"} icon={<Download size={18} color={C.white} />} onPress={() => void installUpdate(update)} />
              <Button title="Later" variant="secondary" onPress={() => setDismissed({ name: update.name, token: install.showToken })} />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
