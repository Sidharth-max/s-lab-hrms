import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScanFace } from "lucide-react-native";
import { Button, Card, Field, Muted, Notice } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";

export default function Login() {
  const { signIn, scannerMode } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ devCode?: string }>("/api/m/auth/request", { phone });
      setDevCode(r.devCode);
      setStep("code");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ token: string }>("/api/m/auth/verify", { phone, code });
      await signIn(r.token);
      router.replace("/(tabs)");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Two-tone: charcoal band behind the status bar with the name; the form sits on the light part. */}
      <View style={{ backgroundColor: C.head, paddingTop: insets.top + 28, paddingBottom: 28, alignItems: "center", gap: 8 }}>
        <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: C.white, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.head, fontWeight: "800", fontSize: 22 }}>S</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "700", color: C.headText }}>S-Lab HRMS</Text>
        <Text style={{ fontSize: 14, color: C.headMuted }}>Attendance and salary</Text>
      </View>
      {/* The page shrinks to the space above the keyboard, so the number and OTP boxes stay visible. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: insets.bottom + 20, gap: 20, width: "100%", maxWidth: 480, alignSelf: "center" }}>
        <Card>
          {step === "phone" ? (
            <>
              <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10 digit mobile" autoFocus maxLength={14} />
              <Button title="Get OTP" onPress={sendCode} loading={busy} disabled={phone.replace(/\D/g, "").length < 10} />
            </>
          ) : (
            <>
              <Muted>OTP sent to {phone}</Muted>
              {devCode ? <Notice text={`Test mode: your OTP is ${devCode}`} /> : null}
              <Field label="OTP" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoFocus style={{ letterSpacing: 6 }} />
              <Button title="Log in" onPress={verify} loading={busy} disabled={code.length !== 6} />
              <Pressable onPress={() => { setStep("phone"); setCode(""); }}>
                <Text style={{ color: C.text, textDecorationLine: "underline", textAlign: "center" }}>Change number / resend OTP</Text>
              </Pressable>
            </>
          )}
          {error ? <Notice text={error} tone="red" /> : null}
        </Card>
        {scannerMode ? (
          <Button title="Back to face scan" variant="secondary" icon={<ScanFace size={18} color={C.text} />} onPress={() => router.replace("/scanner")} />
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
