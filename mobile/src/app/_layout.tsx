import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AuthProvider } from "@/lib/auth";
import { LiveProfileRefresher, LiveProvider } from "@/lib/live";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { DialogProvider } from "@/components/dialog";
import { useFonts, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from "@expo-google-fonts/geist";
import { View } from "react-native";
import { FONT } from "@/components/Text";
import { C } from "@/lib/theme";

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });
  // Wait a moment for the Geist font (it is bundled, so this is instant on the phone).
  if (!fontsReady && !fontError) return <View style={{ flex: 1, backgroundColor: C.white }} />;
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
      <DialogProvider>
      <AuthProvider>
        <LiveProvider>
        <LiveProfileRefresher />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            // Vercel / Linear style: white bar, black title, page just below in light grey.
            headerStyle: { backgroundColor: C.white },
            headerTintColor: C.text,
            headerTitleStyle: { fontFamily: FONT.semibold, fontSize: 17 },
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
        </LiveProvider>
      </AuthProvider>
      </DialogProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
