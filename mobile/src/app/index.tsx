import { Redirect } from "expo-router";
import { Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";

// Signed in: main app. Registered scanner: face scan. Otherwise: login.
export default function Start() {
  const { ready, me, scannerMode } = useAuth();
  if (!ready) return <Loading />;
  if (me) return <Redirect href="/(tabs)" />;
  if (scannerMode) return <Redirect href="/scanner" />;
  return <Redirect href="/login" />;
}
