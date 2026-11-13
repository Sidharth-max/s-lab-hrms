import { router } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/Text";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScanFace } from "@/components/icons";
import { Button, Field, Muted, Notice } from "@/components/ui";
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
  // On a face-scanner device the login page opens over the scanner. Hardware back
  // should return to the scan screen, not pop to a dead screen below.
  useEffect(() => {
    if (!scannerMode) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/scanner");
      return true;
    });
    return () => sub.remove();
  }, [scannerMode]);
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

  async function verify(otp = code) {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ token: string }>("/api/m/auth/verify", { phone, code: otp });
      await signIn(r.token);
      router.replace("/(tabs)");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      {/* Two-tone: charcoal band behind the status bar with the name; the form sits on the light part. */}
      <View style={{ paddingTop: insets.top + 56, paddingHorizontal: 24, paddingBottom: 8, gap: 14, width: "100%", maxWidth: 480, alignSelf: "center" }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.text, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.white, fontWeight: "700", fontSize: 20 }}>S</Text>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: "700", color: C.text, letterSpacing: -0.8 }}>Log in to S-Lab HRMS</Text>
          <Text style={{ fontSize: 15, color: C.muted }}>Attendance and salary for your business.</Text>
        </View>
      </View>
      {/* The page shrinks to the space above the keyboard, so the number and OTP boxes stay visible. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: insets.bottom + 20, gap: 20, width: "100%", maxWidth: 480, alignSelf: "center" }}>
        <View style={{ gap: 14 }}>
          {step === "phone" ? (
            <>
              <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10 digit mobile" autoFocus maxLength={14} />
              <Button title="Get OTP" onPress={sendCode} loading={busy} disabled={phone.replace(/\D/g, "").length < 10} />
            </>
          ) : (
            <>
              <Muted>OTP sent to {phone}</Muted>
              {devCode ? <Notice text={`Test mode: your OTP is ${devCode}`} /> : null}
              {/* OTP from SMS: autoComplete "sms-otp" sets Android's autofill hint, so Google autofill / Gboard
                  offer the code from the incoming SMS with one tap above the keyboard. When 6 digits
                  arrive (typed or filled), we log in by ourselves. */}
              <Field
                label="OTP"
                value={code}
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, "").slice(0, 6);
                  setCode(digits);
                  if (digits.length === 6 && !busy) void verify(digits);
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                importantForAutofill="yes"
                style={{ letterSpacing: 6 }}
              />
              <Button title="Log in" onPress={() => verify()} loading={busy} disabled={code.length !== 6} />
              <Pressable onPress={() => { setStep("phone"); setCode(""); }}>
                <Text style={{ color: C.text, textDecorationLine: "underline", textAlign: "center" }}>Change number / resend OTP</Text>
              </Pressable>
            </>
          )}
          {error ? <Notice text={error} tone="red" /> : null}
        </View>
        {scannerMode ? (
          <Button title="Back to face scan" variant="secondary" icon={<ScanFace size={18} color={C.text} />} onPress={() => router.replace("/scanner")} />
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
