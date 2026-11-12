import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { C } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.white },
            headerTintColor: C.text,
            headerTitleStyle: { fontWeight: "600" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="scanner" options={{ headerShown: false, orientation: "default" }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <UpdatePrompt />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
