import { CameraView, useCameraPermissions } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
import { router, useIsFocused } from "expo-router";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { CircleCheck, CircleX, Download, LogIn, ScanFace } from "@/components/icons";
import { Button } from "@/components/ui";
import { api, type ScanConfig } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCameraSession } from "@/lib/camera";
import { capture } from "@/lib/photo";
import { startUpdate, useAppUpdate } from "@/lib/update";
import { C } from "@/lib/theme";

type Result = { ok: boolean; title: string; detail?: string };

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Scanner() {
  useKeepAwake(); // the tablet screen stays on
  const { scannerMode, leaveScanner } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const camera = useCameraSession();
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
    Speech.stop().catch(() => {});
    Speech.speak(speech ?? r.title, { language: "en-IN", rate: 0.95 });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult(null), 4500);
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
      const image = await capture(cam.current);
      setBusy(false);
      if (!image) return show({ ok: false, title: "Camera not ready" });
      if (config.mode === "mock") return setPicking(image);
      await send({ image });
    } catch (e) {
      setBusy(false);
      show({ ok: false, title: (e as Error).message });
    }
  }, [busy, result, picking, config, ready, send, show]);

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
      {camera.show ? (
        <CameraView key={camera.key} ref={cam} style={StyleSheet.absoluteFill} facing="front" mirror onCameraReady={camera.onReady} />
      ) : null}
      <Pressable style={StyleSheet.absoluteFill} onPress={scan} accessibilityLabel="Scan face">
        <SafeAreaView style={{ flex: 1, justifyContent: "space-between" }}>
          <View style={styles.header}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.headerTitle}>{config?.device.business ?? " "}</Text>
              <Text style={styles.headerSub}>{config ? `${config.device.site} · ${config.device.name}` : configError ?? "Connecting…"}</Text>
            </View>
            <Text style={styles.headerSub}>
              {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
          <View style={styles.oval} pointerEvents="none" />
          <View style={styles.footer}>
            {busy ? <ActivityIndicator color={C.white} size="large" /> : <ScanFace color={C.white} size={40} />}
            <Text style={styles.big}>{busy ? "Checking…" : ready ? "Tap the screen and look at the camera" : "Starting camera…"}</Text>
            {!ready && camera.show ? (
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
              <Pressable onPress={() => router.push("/login")} hitSlop={8} style={styles.action} accessibilityRole="button">
                <LogIn color={C.white} size={18} />
                <Text style={styles.actionText}>Manager / owner login</Text>
              </Pressable>
              {update ? (
                <Pressable onPress={() => startUpdate(update)} hitSlop={8} style={[styles.action, { backgroundColor: C.green, borderColor: C.green }]} accessibilityRole="button">
                  <Download color={C.white} size={18} />
                  <Text style={styles.actionText}>Update app ({update.name})</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </Pressable>

      {picking && config ? (
        <SafeAreaView style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.9)", padding: 16 }]}>
          <Text style={[styles.big, { textAlign: "left" }]}>TEST MODE: who is in front of the camera?</Text>
          <Text style={[styles.headerSub, { marginBottom: 12 }]}>With AWS face recognition on, this step is automatic.</Text>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
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
                <Text style={{ color: C.white, fontWeight: "600", fontSize: 16 }}>{e.name}</Text>
                <Text style={styles.headerSub}>{e.code}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Button title="Cancel" variant="secondary" onPress={() => setPicking(null)} style={{ marginTop: 12 }} />
        </SafeAreaView>
      ) : null}

      {result ? (
        <Pressable onPress={() => setResult(null)} style={[StyleSheet.absoluteFill, styles.result, { backgroundColor: result.ok ? C.green : C.red }]}>
          {result.ok ? <CircleCheck color={C.white} size={96} /> : <CircleX color={C.white} size={96} />}
          <Text style={[styles.big, { fontSize: 32, marginTop: 20 }]}>{result.title}</Text>
          {result.detail ? <Text style={[styles.big, { fontSize: 20, fontWeight: "400", marginTop: 8 }]}>{result.detail}</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, backgroundColor: "rgba(0,0,0,0.55)", gap: 12 },
  headerTitle: { color: C.white, fontWeight: "600", fontSize: 15 },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  oval: { alignSelf: "center", width: "60%", aspectRatio: 3 / 4, borderRadius: 1000, borderWidth: 3, borderColor: "rgba(255,255,255,0.7)" },
  footer: { alignItems: "center", gap: 8, padding: 20, backgroundColor: "rgba(0,0,0,0.6)" },
  big: { color: C.white, fontSize: 22, fontWeight: "600", textAlign: "center" },
  pill: { color: C.white, borderColor: "rgba(255,255,255,0.4)", borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 2, fontSize: 12, overflow: "hidden" },
  result: { alignItems: "center", justifyContent: "center", padding: 24 },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 6 },
  action: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  actionText: { color: C.white, fontWeight: "600", fontSize: 14 },
});
