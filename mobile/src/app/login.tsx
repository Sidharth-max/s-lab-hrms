import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
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
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAwareScrollView bottomOffset={32} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, gap: 20 }}>
        <View style={{ alignItems: "center", gap: 8 }}>
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: C.text, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.white, fontWeight: "700", fontSize: 20 }}>S</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: "700", color: C.text }}>S-Lab HRMS</Text>
          <Muted>Attendance and salary</Muted>
        </View>
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
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
