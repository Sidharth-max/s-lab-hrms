import { CameraView, useCameraPermissions } from "expo-camera";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Image, View } from "react-native";
import { Text } from "@/components/Text";
import { Camera, RotateCcw } from "@/components/icons";
import { Button, Muted, Notice, Screen, Toggle } from "@/components/ui";
import { api } from "@/lib/api";
import { useCameraSession } from "@/lib/camera";
import { capture } from "@/lib/photo";
import { C } from "@/lib/theme";

/** Three photos from slightly different angles make the scanner recognise the person more reliably. */
const STEPS = ["Look straight at the camera", "Turn the head a little to the left", "Turn the head a little to the right"];

export default function FaceEnroll() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const camera = useCameraSession();
  const [photos, setPhotos] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = photos.length >= STEPS.length;

  if (!permission) return <Screen><Muted>Checking camera permission…</Muted></Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Face photos" }} />
        <Muted>The camera is needed to take the face photos.</Muted>
        <Button title="Allow camera" onPress={requestPermission} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: name ? `Face: ${name}` : "Face photos" }} />
      {!done ? (
        <>
          <Text style={{ fontSize: 16, fontWeight: "600", color: C.text, textAlign: "center" }}>
            Photo {photos.length + 1} of {STEPS.length}: {STEPS[photos.length]}
          </Text>
          <View style={{ aspectRatio: 3 / 4, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
            {camera.show ? (
              <CameraView key={camera.key} ref={cam} style={{ flex: 1 }} facing="front" mirror onCameraReady={camera.onReady} />
            ) : null}
          </View>
          <Muted style={{ textAlign: "center" }}>Good light, no cap, mask or dark glasses.</Muted>
        </>
      ) : null}

      {photos.length ? (
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
          {photos.map((p, i) => (
            <Image key={i} source={{ uri: p }} style={{ width: 72, aspectRatio: 3 / 4, borderRadius: 14, backgroundColor: C.line }} />
          ))}
        </View>
      ) : null}

      {!done ? (
        <Button
          title={`Take photo ${photos.length + 1}`}
          icon={<Camera size={18} color={C.white} />}
          disabled={!camera.ready}
          loading={taking}
          onPress={async () => {
            setTaking(true);
            setError(null);
            try {
              const p = await capture(cam.current);
              if (p) setPhotos((list) => [...list, p]);
              else setError("Camera not ready. Try again.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setTaking(false);
            }
          }}
        />
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Toggle value={consent} onValueChange={setConsent} />
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
                await api.action("enrollFace", { id, image: photos, consent: true });
                router.back();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
      {photos.length ? (
        <Button title="Start again" variant="secondary" icon={<RotateCcw size={18} color={C.text} />} onPress={() => { setPhotos([]); setConsent(false); camera.restart(); }} />
      ) : null}
      {error ? <Notice tone="red" text={error} /> : null}
    </Screen>
  );
}
