import { CameraView, useCameraPermissions } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
import { router, useIsFocused } from "expo-router";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { CircleCheck, CircleX, Download, LogIn, ScanFace } from "@/components/icons";
import { Button } from "@/components/ui";
import { api, type ScanConfig } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCameraFacing, useCameraSession } from "@/lib/camera";
import { CameraSwitch } from "@/components/CameraSwitch";
import { haptic } from "@/lib/haptics";
import { capture } from "@/lib/photo";
import { startUpdate, useAppUpdate } from "@/lib/update";

type Result = { ok: boolean; title: string; detail?: string };

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    // Only the minutes are shown: re-render once a minute, not every second (keeps the camera smooth).
    const t = setInterval(() => setNow((p) => { const d = new Date(); return d.getMinutes() === p.getMinutes() && d.getHours() === p.getHours() ? p : d; }), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Scanner() {
  useKeepAwake(); // the tablet screen stays on
  const { scannerMode, leaveScanner } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const lens = useCameraFacing();
  // Waiting screen: a big Scan button with the camera off. Tapping it turns the camera on and the
  // face is scanned by itself once the camera is ready; after the result it goes back to the button.
  const [armed, setArmed] = useState(false);
  const camera = useCameraSession(armed);
  // Light status bar icons on the black screen; the login page on top gets the normal dark icons back.
  const focused = useIsFocused();
  const ready = camera.ready;
  const update = useAppUpdate();
  const [config, setConfig] = useState<ScanConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = useClock();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const loadConfig = useCallback(async () => {
    try {
      setConfig(await api.scanner.config());
      setConfigError(null);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) {
        // The scanner was removed on the server.
        await leaveScanner();
        router.replace("/login");
        return;
      }
      setConfigError((e as Error).message);
    }
  }, [leaveScanner]);

  useEffect(() => {
    if (!scannerMode) {
      router.replace("/login");
      return;
    }
    let alive = true;
    api.scanner.config().then(
      (c) => alive && setConfig(c),
      async (e: { status?: number; message?: string }) => {
        if (!alive) return;
        if (e.status === 401) {
          // The scanner was removed on the server.
          await leaveScanner();
          router.replace("/login");
          return;
        }
        setConfigError(e.message ?? "Could not connect");
      },
    );
    return () => {
      alive = false;
    };
  }, [scannerMode, leaveScanner]);

  const show = useCallback((r: Result, speech?: string) => {
    setResult(r);
    if (r.ok) haptic.success();
    else haptic.error();
    Speech.stop().catch(() => {});
    Speech.speak(speech ?? r.title, { language: "en-IN", rate: 0.95 });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setResult(null);
      setArmed(false); // back to the Scan button, camera off
    }, 3500);
  }, []);

  const send = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await api.scanner.scan(payload);
        if (r.ok) show({ ok: true, title: r.title ?? "Done", detail: `${r.name} (${r.code}) · ${r.time}` }, r.speech);
        else show({ ok: false, title: r.message ?? "Please try again" });
      } catch (e) {
        show({ ok: false, title: (e as Error).message });
      } finally {
        setBusy(false);
      }
    },
    [show],
  );

  const scan = useCallback(async () => {
    if (busy || result || picking || !config || !ready) return;
    if (config.liveness) {
      show({ ok: false, title: "Liveness check is on", detail: "The app scanner does not support it yet. Use the website scanner on this tablet, or turn liveness off on the server." });
      return;
    }
    try {
      setBusy(true);
      // The first frame can arrive a moment after "camera ready": try once more before giving up.
      let image: string | null = null;
      for (let attempt = 0; attempt < 2 && !image; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 800));
        image = await capture(cam.current).catch(() => null);
      }
      setBusy(false);
      if (!image) return show({ ok: false, title: "Camera not ready", detail: "Tap Scan to try again" });
      if (config.mode === "mock") return setPicking(image);
      await send({ image });
    } catch (e) {
      setBusy(false);
      show({ ok: false, title: (e as Error).message });
    }
  }, [busy, result, picking, config, ready, send, show]);

  // Auto-scan: shortly after the camera is ready (time for focus / exposure), take the photo.
  useEffect(() => {
    if (!armed || !ready || busy || result || picking || !config) return;
    const t = setTimeout(() => void scan(), 1000);
    return () => clearTimeout(t);
  }, [armed, ready, busy, result, picking, config, scan]);

  // Safety: if nothing happened (camera never started), go back to the button.
  useEffect(() => {
    if (!armed || result || picking || busy) return;
    const t = setTimeout(() => setArmed(false), 20000);
    return () => clearTimeout(t);
  }, [armed, result, picking, busy]);

  const arm = useCallback(() => {
    if (!config || result || busy) return;
    haptic.select();
    setArmed(true);
  }, [config, result, busy]);

  const status = !armed
    ? config ? "Tap Scan to mark your attendance" : "Connecting…"
    : busy ? "Checking…" : ready ? "Look at the camera…" : "Starting camera…";

  if (!permission) return <View style={styles.black}>{focused ? <StatusBar style="light" /> : null}</View>;
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.black, { justifyContent: "center", padding: 24, gap: 16 }]}>
        {focused ? <StatusBar style="light" /> : null}
        <Text style={styles.big}>Camera permission needed</Text>
        <Button title="Allow camera" variant="secondary" onPress={requestPermission} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.black}>
      {focused ? <StatusBar style="light" /> : null}
      {armed && camera.show ? (
        <CameraView key={`${camera.key}-${lens.facing}`} ref={cam} style={StyleSheet.absoluteFill} facing={lens.facing} mirror={lens.mirror} onCameraReady={camera.onReady} />
      ) : null}
      <Pressable style={StyleSheet.absoluteFill} onPress={armed ? undefined : arm} accessibilityLabel="Scan face" disabled={armed}>
        {landscape ? (
          // Landscape (tablet / phone on a stand): camera oval on the left, details and buttons on the right.
          <SafeAreaView style={{ flex: 1, flexDirection: "row" }} edges={["top", "bottom", "left", "right"]}>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
              {armed ? <View style={[styles.oval, { width: Math.round(height * 0.72 * 0.75), height: Math.round(height * 0.72)}]} /> : <ScanButton size={Math.round(height * 0.5)} />}
            </View>
            <View style={styles.side}>
              <View style={[styles.header, { backgroundColor: "transparent", padding: 0 }]}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.headerTitle}>{config?.device.business ?? " "}</Text>
              <Text style={styles.headerSub}>{config ? `${config.device.site} · ${config.device.name}` : configError ?? "Connecting…"}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 8 }}>
              <Text style={styles.headerSub}>
                {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </Text>
              {/* Switch lens (front / back); remembered on this device. Does not start a scan. */}
              <CameraSwitch facing={lens.facing} onPress={lens.toggle} label={false} />
            </View>
          </View>
              <View style={[styles.footer, { backgroundColor: "transparent", padding: 0 }]}>
            {busy ? <ActivityIndicator color={"#fff"} size="large" /> : armed ? <ScanFace color={"#fff"} size={40} /> : null}
            <Text style={styles.big}>{status}</Text>
            {armed && !ready && camera.show ? (
              <Pressable onPress={camera.restart} style={{ padding: 8 }}>
                <Text style={[styles.headerSub, { textDecorationLine: "underline" }]}>Camera black? Tap to restart it</Text>
              </Pressable>
            ) : null}
            {config?.mode === "mock" ? <Text style={styles.pill}>TEST MODE</Text> : null}
            {configError ? (
              <Pressable onPress={loadConfig} style={{ padding: 8 }}>
                <Text style={[styles.headerSub, { textDecorationLine: "underline" }]}>Retry connection</Text>
              </Pressable>
            ) : null}
            <View style={styles.actions}>
              <Pressable onPress={() => router.replace("/login")} hitSlop={8} style={styles.action} accessibilityRole="button">
                <LogIn color={"#fff"} size={18} />
                <Text style={styles.actionText}>Manager / owner login</Text>
              </Pressable>
              {update ? (
                <Pressable onPress={() => startUpdate(update)} hitSlop={8} style={[styles.action, { backgroundColor: "#16a34a", borderColor: "#16a34a" }]} accessibilityRole="button">
                  <Download color={"#fff"} size={18} />
                  <Text style={styles.actionText}>Update app ({update.name})</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
            </View>
          </SafeAreaView>
        ) : (
        <SafeAreaView style={{ flex: 1, justifyContent: "space-between" }}>
          <View style={styles.header}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.headerTitle}>{config?.device.business ?? " "}</Text>
              <Text style={styles.headerSub}>{config ? `${config.device.site} · ${config.device.name}` : configError ?? "Connecting…"}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 8 }}>
              <Text style={styles.headerSub}>
                {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </Text>
              {/* Switch lens (front / back); remembered on this device. Does not start a scan. */}
              <CameraSwitch facing={lens.facing} onPress={lens.toggle} label={false} />
            </View>
          </View>
          {armed ? (
            <View style={[styles.oval, { width: Math.round(Math.min(width * 0.6, height * 0.45 * 0.75)), height: Math.round(Math.min(width * 0.6, height * 0.45 * 0.75) * 4 / 3)}]} pointerEvents="none" />
          ) : (
            <View style={{ alignItems: "center" }} pointerEvents="none"><ScanButton size={Math.round(Math.min(width * 0.62, height * 0.34))} /></View>
          )}
          <View style={styles.footer}>
            {busy ? <ActivityIndicator color={"#fff"} size="large" /> : armed ? <ScanFace color={"#fff"} size={40} /> : null}
            <Text style={styles.big}>{status}</Text>
            {armed && !ready && camera.show ? (
              <Pressable onPress={camera.restart} style={{ padding: 8 }}>
                <Text style={[styles.headerSub, { textDecorationLine: "underline" }]}>Camera black? Tap to restart it</Text>
              </Pressable>
            ) : null}
            {config?.mode === "mock" ? <Text style={styles.pill}>TEST MODE</Text> : null}
            {configError ? (
              <Pressable onPress={loadConfig} style={{ padding: 8 }}>
                <Text style={[styles.headerSub, { textDecorationLine: "underline" }]}>Retry connection</Text>
              </Pressable>
            ) : null}
            <View style={styles.actions}>
              <Pressable onPress={() => router.replace("/login")} hitSlop={8} style={styles.action} accessibilityRole="button">
                <LogIn color={"#fff"} size={18} />
                <Text style={styles.actionText}>Manager / owner login</Text>
              </Pressable>
              {update ? (
                <Pressable onPress={() => startUpdate(update)} hitSlop={8} style={[styles.action, { backgroundColor: "#16a34a", borderColor: "#16a34a" }]} accessibilityRole="button">
                  <Download color={"#fff"} size={18} />
                  <Text style={styles.actionText}>Update app ({update.name})</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
        )}
      </Pressable>

      {picking && config ? (
        <SafeAreaView style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.9)", padding: 16 }]}>
          <Text style={[styles.big, { textAlign: "left" }]}>TEST MODE: who is in front of the camera?</Text>
          <Text style={[styles.headerSub, { marginBottom: 12 }]}>With AWS face recognition on, this step is automatic.</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {config.testEmployees.length === 0 ? <Text style={styles.headerSub}>No employee has a face enrolled yet.</Text> : null}
            {config.testEmployees.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => {
                  const img = picking;
                  setPicking(null);
                  void send({ image: img, mockEmployeeId: e.id });
                }}
                style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 14 }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>{e.name}</Text>
                <Text style={styles.headerSub}>{e.code}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Button title="Cancel" variant="secondary" onPress={() => { setPicking(null); setArmed(false); }} style={{ marginTop: 12 }} />
        </SafeAreaView>
      ) : null}

      {result ? (
        <Pressable onPress={() => setResult(null)} style={[StyleSheet.absoluteFill, styles.result, { backgroundColor: result.ok ? "#16a34a" : "#dc2626" }]}>
          {result.ok ? <CircleCheck color={"#fff"} size={96} /> : <CircleX color={"#fff"} size={96} />}
          <Text style={[styles.big, { fontSize: 32, marginTop: 20 }]}>{result.title}</Text>
          {result.detail ? <Text style={[styles.big, { fontSize: 20, fontWeight: "400", marginTop: 8 }]}>{result.detail}</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

/** The big round Scan button on the waiting screen, gently pulsing. */
function ScanButton({ size }: { size: number }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.1 }], opacity: 0.22 - pulse.value * 0.18 }));
  return (
    <View style={{ width: size * 1.2, height: size * 1.2, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size * 1.16, height: size * 1.16, borderRadius: size, backgroundColor: "#ffffff" }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#4a3cff", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 4, borderColor: "rgba(255,255,255,0.85)" }}>
        <ScanFace color={"#fff"} size={Math.round(size * 0.34)} />
        <Text style={{ color: "#fff", fontSize: Math.max(18, Math.round(size * 0.11)), fontWeight: "700" }}>Scan</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, backgroundColor: "rgba(0,0,0,0.55)", gap: 12 },
  headerTitle: { color: "#fff", fontWeight: "600", fontSize: 15 },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  oval: { alignSelf: "center", borderRadius: 1000, borderWidth: 3, borderColor: "rgba(255,255,255,0.7)" },
  footer: { alignItems: "center", gap: 8, padding: 20, backgroundColor: "rgba(0,0,0,0.6)" },
  big: { color: "#fff", fontSize: 22, fontWeight: "600", textAlign: "center" },
  pill: { color: "#fff", borderColor: "rgba(255,255,255,0.4)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, fontSize: 12, overflow: "hidden" },
  result: { alignItems: "center", justifyContent: "center", padding: 24 },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 6 },
  action: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  actionText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  side: { width: "40%", maxWidth: 420, justifyContent: "space-between", padding: 20, gap: 16, backgroundColor: "rgba(0,0,0,0.6)" },
});
