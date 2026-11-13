import { CameraView, useCameraPermissions } from "expo-camera";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { Text } from "@/components/Text";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, CircleCheck, RotateCcw, ScanFace, type IconType } from "@/components/icons";
import { Button, Muted, Notice, Screen, Toggle } from "@/components/ui";
import { api } from "@/lib/api";
import { useCameraSession } from "@/lib/camera";
import { haptic } from "@/lib/haptics";
import { capture } from "@/lib/photo";
import { C } from "@/lib/theme";

// Guided face scan: one continuous session. The screen shows where to look (straight, right, left,
// up, down) and takes each picture by itself as soon as the head is turned the right way
// (checked on the server). Nobody has to press a shutter button.

const STEPS: { key: string; text: string; Icon: IconType }[] = [
  { key: "straight", text: "Look straight at the camera", Icon: ScanFace },
  { key: "side1", text: "Slowly turn your head to the right", Icon: ArrowRight },
  { key: "side2", text: "Now turn your head to the left", Icon: ArrowLeft },
  { key: "vert1", text: "Look up a little", Icon: ArrowUp },
  { key: "vert2", text: "Look down a little", Icon: ArrowDown },
];
const MAX_TRIES = 9; // per step; extra angles are skipped after this, the straight photo is required

export default function FaceEnroll() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const camera = useCameraSession();
  const [phase, setPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0); // increases to stop an old scan loop

  useEffect(() => () => { run.current += 1; }, []);

  async function scan() {
    const me = ++run.current;
    setPhase("scanning");
    setPhotos([]);
    setError(null);
    setHint(null);
    const kept: string[] = [];
    const signs: Record<string, number> = {};
    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      setHint(null);
      let accepted = false;
      for (let t = 0; t < MAX_TRIES && !accepted; t++) {
        await new Promise((r) => setTimeout(r, t === 0 ? 900 : 350)); // time to read the prompt and move
        if (run.current !== me) return;
        try {
          const image = await capture(cam.current);
          if (run.current !== me) return;
          if (!image) continue;
          const s = STEPS[i].key;
          const r = await api.post<{ accept: boolean; hint?: string; sign?: number }>("/api/m/face/pose", { image, step: s, ref: s === "side2" ? signs.side1 : s === "vert2" ? signs.vert1 : 0 });
          if (run.current !== me) return;
          if (r.accept) {
            if (r.sign) signs[s] = r.sign;
            kept.push(image);
            setPhotos([...kept]);
            haptic.success();
            accepted = true;
          } else setHint(r.hint ?? "Hold still");
        } catch (e) {
          if (run.current !== me) return;
          setHint((e as Error).message);
        }
      }
      if (!accepted && i === 0) {
        haptic.error();
        setPhase("idle");
        setError("Could not see the face clearly. Use good light, remove cap, mask or dark glasses, and start again.");
        return;
      }
    }
    setPhase("done");
  }

  if (!permission) return <Screen><Muted>Checking camera permission…</Muted></Screen>;
  if (!permission.granted) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Face scan" }} />
        <Muted>The camera is needed for the face scan.</Muted>
        <Button title="Allow camera" onPress={requestPermission} />
      </Screen>
    );
  }

  const Current = STEPS[step];
  return (
    <Screen>
      <Stack.Screen options={{ title: name ? `Face: ${name}` : "Face scan" }} />
      {phase !== "done" ? (
        <>
          <View style={{ aspectRatio: 3 / 4, borderRadius: 20, overflow: "hidden", backgroundColor: "#000" }}>
            {camera.show ? <CameraView key={camera.key} ref={cam} style={{ flex: 1 }} facing="front" mirror onCameraReady={camera.onReady} /> : null}
            {phase === "scanning" ? (
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, gap: 8, alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)" }}>
                <Current.Icon size={44} color="#fff" weight="bold" />
                <Text style={{ color: "#fff", fontSize: 19, fontWeight: "700", textAlign: "center" }}>{Current.text}</Text>
                {hint ? <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, textAlign: "center" }}>{hint}</Text> : null}
              </View>
            ) : null}
          </View>
          {/* Progress: one bar per direction */}
          <View style={{ flexDirection: "row", gap: 6 }} accessibilityLabel={`Step ${Math.min(step + 1, STEPS.length)} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <View key={s.key} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: phase === "scanning" && i < step ? C.green : phase === "scanning" && i === step ? C.text : C.line }} />
            ))}
          </View>
          {phase === "idle" ? (
            <>
              <Muted style={{ textAlign: "center" }}>Hold the phone at face height in good light. Follow the arrows: the pictures are taken automatically.</Muted>
              <Button title="Start face scan" icon={<Camera size={18} color={C.white} />} disabled={!camera.ready} onPress={() => void scan()} />
            </>
          ) : (
            <Button title="Stop" variant="secondary" onPress={() => { run.current += 1; setPhase("idle"); setPhotos([]); }} />
          )}
        </>
      ) : (
        <>
          <View style={{ alignItems: "center", gap: 8, paddingVertical: 8 }}>
            <CircleCheck size={56} color={C.green} weight="fill" />
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Scan complete</Text>
            <Muted>{photos.length} of {STEPS.length} angles captured</Muted>
          </View>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {photos.map((p, i) => <Image key={i} source={{ uri: p }} style={{ width: 58, aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: C.line }} />)}
          </View>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Toggle value={consent} onValueChange={setConsent} label="Employee was told how the face is used" />
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
          <Button title="Scan again" variant="secondary" icon={<RotateCcw size={18} color={C.text} />} onPress={() => { setConsent(false); camera.restart(); void scan(); }} />
        </>
      )}
      {error ? <Notice tone="red" text={error} /> : null}
    </Screen>
  );
}
