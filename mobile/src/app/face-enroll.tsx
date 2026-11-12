import { CameraView, useCameraPermissions } from "expo-camera";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Image, Switch, Text, View } from "react-native";
import { Camera, RotateCcw } from "lucide-react-native";
import { Button, Muted, Notice, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { capture } from "@/lib/photo";
import { C } from "@/lib/theme";

export default function FaceEnroll() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!permission) return <Screen><Muted>Checking camera permission…</Muted></Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Face photo" }} />
        <Muted>The camera is needed to take the face photo.</Muted>
        <Button title="Allow camera" onPress={requestPermission} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: name ? `Face: ${name}` : "Face photo" }} />
      <View style={{ aspectRatio: 3 / 4, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ flex: 1 }} />
        ) : (
          <CameraView ref={cam} style={{ flex: 1 }} facing="front" mirror onCameraReady={() => setReady(true)} />
        )}
      </View>
      <Muted style={{ textAlign: "center" }}>Face straight, good light, no cap, mask or dark glasses.</Muted>
      {photo ? (
        <>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Switch value={consent} onValueChange={setConsent} trackColor={{ true: C.green, false: C.line }} />
            <Text style={{ flex: 1, color: C.text, fontSize: 14 }}>
              The employee was told the face is used only to mark attendance, and that a manager can mark attendance for them instead.
            </Text>
          </View>
          <Button
            title="Save face"
            loading={busy}
            disabled={!consent}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.action("enrollFace", { id, image: photo, consent: true });
                router.back();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button title="Retake" variant="secondary" icon={<RotateCcw size={18} color={C.text} />} onPress={() => setPhoto(null)} />
        </>
      ) : (
        <Button
          title="Take photo"
          icon={<Camera size={18} color={C.white} />}
          disabled={!ready}
          onPress={async () => {
            try {
              setPhoto(await capture(cam.current));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      {error ? <Notice tone="red" text={error} /> : null}
    </Screen>
  );
}
