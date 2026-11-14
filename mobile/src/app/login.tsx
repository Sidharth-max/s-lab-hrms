import { router } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, Image, Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "@/components/Text";
import { GradientFill } from "@/components/Viz";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, ScanFace } from "@/components/icons";
import { Button, Field, Notice } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { C, shadow } from "@/lib/theme";

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
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* The page shrinks to the space above the keyboard, so the number and OTP boxes stay visible. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 20 }}>
        {/* Gradient hero with the app logo (same look as the Today screen). */}
        <View style={{ paddingTop: insets.top + 40, paddingBottom: 72, paddingHorizontal: 24, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: "hidden", alignItems: "center", gap: 14 }}>
          <GradientFill />
          <View style={{ borderRadius: 26, padding: 4, backgroundColor: "rgba(255,255,255,0.22)" }}>
            <Image source={require("../../assets/icon.png")} style={{ width: 84, height: 84, borderRadius: 22 }} accessibilityLabel="S-Lab HRMS logo" />
          </View>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ color: "#fff", fontSize: 30, fontWeight: "700", letterSpacing: -0.8 }}>S-Lab HRMS</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, textAlign: "center" }}>Face attendance and salary for your business</Text>
          </View>
        </View>

        <View style={{ marginTop: -44, paddingHorizontal: 16, width: "100%", maxWidth: 480, alignSelf: "center", gap: 14 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 28, borderWidth: 1, borderColor: C.hairline, padding: 20, gap: 16, ...shadow(2) }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: C.text, letterSpacing: -0.4 }}>{step === "phone" ? "Log in" : "Enter OTP"}</Text>
              <Text style={{ fontSize: 14, color: C.muted }}>{step === "phone" ? "We will send a 6 digit code by SMS." : `Sent to ${phone}`}</Text>
            </View>
            {step === "phone" ? (
              <>
                <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10 digit mobile" autoFocus maxLength={14} />
                <Button title="Get OTP" icon={<ArrowRight size={18} color="#ffffff" />} onPress={sendCode} loading={busy} disabled={phone.replace(/\D/g, "").length < 10} />
              </>
            ) : (
              <>
                {devCode ? <Notice text={`Test mode: your OTP is ${devCode}`} /> : null}
                <OtpBoxes
                  value={code}
                  onChange={(digits) => {
                    setCode(digits);
                    if (digits.length === 6 && !busy) void verify(digits);
                  }}
                />
                <Button title="Log in" onPress={() => verify()} loading={busy} disabled={code.length !== 6} />
                <Pressable onPress={() => { setStep("phone"); setCode(""); }} hitSlop={8}>
                  <Text style={{ color: C.brandInk, fontWeight: "600", textAlign: "center" }}>Change number / resend OTP</Text>
                </Pressable>
              </>
            )}
            {error ? <Notice text={error} tone="red" /> : null}
          </View>
          {scannerMode ? (
            <Button title="Back to face scan" variant="secondary" icon={<ScanFace size={18} color={C.text} />} onPress={() => router.replace("/scanner")} />
          ) : null}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Six OTP boxes over one real text field: the field keeps Android's SMS autofill hint
 * (autoComplete "sms-otp"), so Gboard / Google autofill still offer the code with one tap.
 */
function OtpBoxes({ value, onChange }: { value: string; onChange: (digits: string) => void }) {
  const [focused, setFocused] = useState(true);
  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8 }} pointerEvents="none">
        {Array.from({ length: 6 }, (_, i) => {
          const active = focused && (i === value.length || (i === 5 && value.length === 6));
          return (
            <View key={i} style={{ flex: 1, height: 56, borderRadius: 16, borderWidth: active ? 2 : 1, borderColor: active ? C.brand : value[i] ? C.line : C.hairline, backgroundColor: value[i] ? C.brandSoft : C.soft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 24, fontWeight: "700", color: C.text, fontVariant: ["tabular-nums"] }}>{value[i] ?? ""}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        importantForAutofill="yes"
        caretHidden
        accessibilityLabel="OTP"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, color: "transparent", opacity: 0.02, fontSize: 1 }}
      />
    </View>
  );
}
