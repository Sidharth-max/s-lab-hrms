import { useState } from "react";
import { Linking, Modal, Text, View } from "react-native";
import { Button, Muted } from "./ui";
import { useAppUpdate } from "@/lib/update";
import { C } from "@/lib/theme";

/** Shows a pop-up when a newer APK is published (also on the face scanner). */
export function UpdatePrompt() {
  const update = useAppUpdate();
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!update || dismissed === update.name) return null;
  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent navigationBarTranslucent onRequestClose={() => setDismissed(update.name)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: C.white, borderRadius: 12, padding: 20, gap: 12, maxWidth: 420, width: "100%", alignSelf: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>There is a new update</Text>
          <Muted>Version {update.name}. Download it, open the file and tap Update. Your login and data stay.</Muted>
          <Button title="Download update" onPress={() => Linking.openURL(update.url)} />
          <Button title="Later" variant="secondary" onPress={() => setDismissed(update.name)} />
        </View>
      </View>
    </Modal>
  );
}
