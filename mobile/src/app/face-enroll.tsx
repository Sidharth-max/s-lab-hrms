import { CameraView, useCameraPermissions } from "expo-camera";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { Text } from "@/components/Text";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Check, CircleCheckFilled, RotateCcw, ScanFace, type IconType } from "@/components/icons";
import { Button, Muted, Notice, Screen, Toggle } from "@/components/ui";
import { api } from "@/lib/api";
import { useCameraSession } from "@/lib/camera";
import { haptic } from "@/lib/haptics";
import { capture } from "@/lib/photo";
import { C } from "@/lib/theme";
import { SuccessPop } from "@/lib/motion";

// Guided, direction-aware face enrolment.
//
// Before: the screen showed a prompt and then took pictures on a timer; the server only checked the
// head angle, not where the face was, so a face that drifted to the side was still saved.
// Now: every frame (about 2 per second) goes to the server's face guide, which returns the face box
// and head pose (AWS Rekognition landmarks: yaw / pitch / roll) and checks, in this order:
// one face, distance, centred in the oval, light, head level, then the step's direction.
// A photo is kept only when TWO frames in a row satisfy the step AND barely differ (stable).
// The screen shows the live instruction ("Move a little to the left", "Turn the other way",
// "Hold still") and a progress bar per step.

const STEPS: { key: "straight" | "side1" | "side2" | "vert1" | "vert2"; title: string; say: string; Icon: IconType }[] = [
  { key: "straight", title: "Straight", say: "Look straight at the camera", Icon: ScanFace },
  { key: "side1", title: "Left", say: "Slowly turn your head to the left", Icon: ArrowLeft },
  { key: "side2", title: "Right", say: "Now turn your head to the right", Icon: ArrowRight },
  { key: "vert1", title: "Up", say: "Look up a little", Icon: ArrowUp },
  { key: "vert2", title: "Down", say: "Now look down a little", Icon: ArrowDown },
];
const STEP_TIMEOUT_MS = 30000; // extra angles are skipped after this; the straight photo is required

interface Reading { yaw: number; pitch: number; roll: number; box: { left: number; top: number; width: number; height: number } }
interface GuideReply { accept: boolean; verified: boolean; fix?: string; hint?: string; sign?: number; progress?: number; face?: Reading | null }

/** Same rule as the server's guide.ts: the head and the face box barely moved between two frames. */
function stable(a: Reading, b: Reading) {
  const ca = [a.box.left + a.box.width / 2, a.box.top + a.box.height / 2];
  const cb = [b.box.left + b.box.width / 2, b.box.top + b.box.height / 2];
  return Math.abs(a.yaw - b.yaw) < 6 && Math.abs(a.pitch - b.pitch) < 6 && Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) < 0.05;
}

type Live = { tone: "idle" | "fix" | "hold" | "ok"; hint: string; progress: number };

export default function FaceEnroll() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const camera = useCameraSession();
  const [phase, setPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<boolean[]>(STEPS.map(() => false));
  const [photos, setPhotos] = useState<string[]>([]);
  const [live, setLive] = useState<Live>({ tone: "idle", hint: "", progress: 0 });
  const [unverified, setUnverified] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0); // increases to stop an old scan loop

  useEffect(() => () => { run.current += 1; Speech.stop().catch(() => {}); }, []);

  const say = (text: string) => {
    Speech.stop().catch(() => {});
    Speech.speak(text, { language: "en-IN", rate: 0.95 });
  };

  async function scan() {
    const me = ++run.current;
    const alive = () => run.current === me;
    setPhase("scanning");
    setPhotos([]);
    setDone(STEPS.map(() => false));
    setError(null);
    const kept: string[] = [];
    const signs: Record<string, number> = {};
    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i];
      setStep(i);
      setLive({ tone: "idle", hint: s.say, progress: 0 });
      say(s.say);
      await new Promise((r) => setTimeout(r, 700)); // time to read the prompt and start moving
      let prev: Reading | null = null;
      let accepted = false;
      const started = Date.now();
      while (!accepted && Date.now() - started < STEP_TIMEOUT_MS) {
        if (!alive()) return;
        let image: string | null = null;
        try {
          image = await capture(cam.current, { width: 800, quality: 0.75 });
        } catch {
          image = null;
        }
        if (!alive()) return;
        if (!image) continue;
        let r: GuideReply;
        try {
          r = await api.post<GuideReply>("/api/m/face/pose", { image, step: s.key, ref: s.key === "side2" ? signs.side1 : s.key === "vert2" ? signs.vert1 : 0 });
        } catch (e) {
          if (!alive()) return;
          setLive({ tone: "fix", hint: (e as Error).message, progress: 0 });
          continue;
        }
        if (!alive()) return;
        if (!r.verified) {
          // The server cannot read faces (test mode / AWS permission missing): timed capture.
          setUnverified(true);
          for (let n = 3; n > 0; n--) {
            setLive({ tone: "hold", hint: `${s.say} · ${n}`, progress: (4 - n) / 3 });
            await new Promise((res) => setTimeout(res, 800));
            if (!alive()) return;
          }
          const shot = await capture(cam.current).catch(() => null);
          if (!alive()) return;
          if (shot) {
            if (r.sign) signs[s.key] = r.sign;
            kept.push(shot);
            accepted = true;
          }
          continue;
        }
        if (r.accept && r.face) {
          if (prev && stable(prev, r.face)) {
            if (r.sign) signs[s.key] = r.sign;
            kept.push(image);
            accepted = true;
          } else {
            prev = r.face;
            setLive({ tone: "hold", hint: "Hold still…", progress: 0.85 });
          }
        } else {
          prev = null;
          setLive({ tone: "fix", hint: r.hint ?? "Adjust your position", progress: r.progress ?? 0 });
        }
      }
      if (!alive()) return;
      if (accepted) {
        haptic.success();
        setPhotos([...kept]);
        setDone((d) => d.map((v, j) => (j === i ? true : v)));
        setLive({ tone: "ok", hint: "Got it", progress: 1 });
        await new Promise((r) => setTimeout(r, 450));
      } else if (i === 0) {
        haptic.error();
        setPhase("idle");
        setError("Could not get a clear, centred straight photo. Use good light, remove cap, mask or dark glasses, keep the face inside the oval and start again.");
        return;
      } else {
        haptic.warning();
      }
    }
    say("Face scan complete");
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
  const ring = { idle: "rgba(255,255,255,0.85)", fix: "#fbbf24", hold: "#4ade80", ok: "#22c55e" }[live.tone];
  return (
    <Screen>
      <Stack.Screen options={{ title: name ? `Face: ${name}` : "Face scan" }} />
      {phase !== "done" ? (
        <>
          <View style={{ aspectRatio: 3 / 4, borderRadius: 28, overflow: "hidden", backgroundColor: "#000" }}>
            {camera.show ? <CameraView key={camera.key} ref={cam} style={{ flex: 1 }} facing="front" mirror onCameraReady={camera.onReady} /> : null}
            {/* Oval guide: the face must stay inside it. Its colour is the live state. */}
            <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: "62%", aspectRatio: 0.78, borderRadius: 999, borderWidth: 4, borderColor: phase === "scanning" ? ring : "rgba(255,255,255,0.6)", marginTop: -36 }} />
            </View>
            {phase === "scanning" ? (
              <>
                <View pointerEvents="none" style={{ position: "absolute", top: 14, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Step {step + 1} of {STEPS.length} · {Current.title}</Text>
                </View>
                <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, gap: 6, alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" }} accessibilityLiveRegion="polite">
                  <Current.Icon size={40} color="#fff" strokeWidth={2.4} />
                  <Text style={{ color: "#fff", fontSize: 19, fontWeight: "700", textAlign: "center" }}>{Current.say}</Text>
                  <Text style={{ color: ring, fontSize: 15, fontWeight: "600", textAlign: "center" }}>{live.hint !== Current.say ? live.hint : " "}</Text>
                  <View style={{ alignSelf: "stretch", height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden", marginTop: 4 }}>
                    <View style={{ width: `${Math.round(live.progress * 100)}%`, height: 6, backgroundColor: ring }} />
                  </View>
                </View>
              </>
            ) : null}
          </View>
          {/* Progress per direction */}
          <View style={{ flexDirection: "row", gap: 6 }} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => {
              const isDone = done[i];
              const current = phase === "scanning" && i === step && !isDone;
              return (
                <View key={s.key} style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 8, borderRadius: 14, backgroundColor: isDone ? C.tint.green : current ? C.brandSoft : C.card, borderWidth: 1, borderColor: current ? C.brand : C.hairline }}>
                  {isDone ? <Check size={18} color={C.ink.green} strokeWidth={2.6} /> : <s.Icon size={18} color={current ? C.brandInk : C.muted} />}
                  <Text style={{ fontSize: 11, fontWeight: "600", color: isDone ? C.ink.green : current ? C.brandInk : C.muted }}>{s.title}</Text>
                </View>
              );
            })}
          </View>
          {unverified ? <Notice text="Live face check is off on this server (test mode or missing AWS permission). Photos are taken on a countdown instead: keep the face inside the oval." /> : null}
          {phase === "idle" ? (
            <>
              <Muted style={{ textAlign: "center" }}>Hold the phone at face height in good light. Keep the face inside the oval and follow the voice: each photo is taken by itself once the head is in position and still.</Muted>
              <Button title="Start face scan" icon={<Camera size={18} color={C.headText} />} disabled={!camera.ready} onPress={() => void scan()} />
            </>
          ) : (
            <Button title="Stop" variant="secondary" onPress={() => { run.current += 1; Speech.stop().catch(() => {}); setPhase("idle"); setPhotos([]); }} />
          )}
        </>
      ) : (
        <>
          <View style={{ alignItems: "center", gap: 8, paddingVertical: 8 }}>
            <SuccessPop><CircleCheckFilled size={64} color={C.green} /></SuccessPop>
            <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Scan complete</Text>
            <Muted>{photos.length} of {STEPS.length} directions captured</Muted>
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
