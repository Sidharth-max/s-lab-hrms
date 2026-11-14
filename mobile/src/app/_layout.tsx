import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useKeepAwake } from "expo-keep-awake";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LiveProfileRefresher, LiveProvider } from "@/lib/live";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { DialogProvider } from "@/components/dialog";
import { useFonts, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from "@expo-google-fonts/geist";
import { Appearance, View } from "react-native";
import { FONT } from "@/components/Text";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { C, isDark, setThemePref, themePref } from "@/lib/theme";
import { nameOf } from "@/lib/names";

/** Header title for a screen about one person: the name we already know, never the raw id. */
function personTitle(params: object | undefined, idKey: string, fallback: string) {
  const p = (params ?? {}) as Record<string, string | undefined>;
  return nameOf(p[idKey], p.name) ?? fallback;
}

/**
 * Routes are split with Stack.Protected:
 *  - signed out: login and the face scanner;
 *  - signed in: the tabs and every screen opened from them.
 * When the sign-in state changes, the routes of the other group are removed from the history.
 * That fixes "Back logs me out" and "two swipes to close the app": before, the login (or scanner)
 * screen stayed underneath the tabs, so Back from Today showed it, and a second Back closed the app.
 */
function RootStack() {
  const { ready, me, scannerMode } = useAuth();
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  const signedIn = !!me;
  return (
    <Stack
      screenOptions={{
        // Transparent header: pages scroll underneath and BlurFrame (components/BlurFrame.tsx) frosts
        // the status bar + header area.
        headerTransparent: true,
        headerStyle: { backgroundColor: "transparent" },
        headerTintColor: C.text,
        // Bold title on the page background, like the tab screens (no separate white bar).
        headerTitleStyle: { fontFamily: FONT.bold, fontSize: 20, color: C.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: C.bg },
        // Smooth slide in from the right, the page behind sliding a little (native, on the UI thread).
        // The Android system default (fade + zoom over a dark scrim) flashed black between pages.
        animation: "ios_from_right",
        animationDuration: 300,
        gestureEnabled: true,
        // Pages underneath stop re-rendering while hidden (live updates no longer cause jank in the
        // page you are looking at); they catch up the moment they are shown again.
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* redirectTo: where a screen goes once its group is no longer allowed. Without it the router fell
          back to "/" (index), whose own Redirect ran while the change was still in progress, so Log out
          looped ("Maximum update depth exceeded") and the scanner only appeared after restarting the app. */}
      <Stack.Protected guard={!signedIn} redirectTo="/(tabs)">
        <Stack.Screen name="login" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="scanner" options={{ headerShown: false, orientation: "default", animation: "fade" }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn} redirectTo={scannerMode ? "/scanner" : "/login"}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="employee/[id]" options={({ route }) => ({ title: personTitle(route.params, "id", "Employee") })} />
        <Stack.Screen name="employee/edit/[id]" options={{ title: "Edit employee" }} />
        <Stack.Screen name="employee/new" options={{ title: "Add employee" }} />
        <Stack.Screen name="attendance/[employeeId]/[date]" options={({ route }) => ({ title: personTitle(route.params, "employeeId", "Attendance") })} />
        <Stack.Screen name="advance/[id]" options={{ title: "Advance" }} />
        <Stack.Screen name="advances" options={{ title: "Advances" }} />
        <Stack.Screen name="approvals" options={{ title: "Approvals" }} />
        <Stack.Screen name="devices" options={{ title: "Scanner devices" }} />
        <Stack.Screen name="face-enroll" options={{ title: "Face scan" }} />
        <Stack.Screen name="history" options={{ title: "History" }} />
        <Stack.Screen name="leaves" options={{ title: "Leave" }} />
        <Stack.Screen name="register" options={{ title: "Monthly register" }} />
        <Stack.Screen name="scanner-setup" options={{ title: "Face scanner" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="shift/[id]" options={{ title: "Shift" }} />
        <Stack.Screen name="team" options={{ title: "Managers" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // The screen does not dim or lock while the app is open (the phone's own timeout applies again once the
  // app is in the background or closed).
  useKeepAwake();
  const [fontsReady, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });
  useEffect(() => {
    // Window colour behind the screens (seen during transitions and behind the keyboard).
    void SystemUI.setBackgroundColorAsync(C.bg).catch(() => {});
    if (themePref !== "system") return;
    // Following the phone: when it switches between light and dark, restart with the other palette.
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if ((colorScheme === "dark") !== isDark) void setThemePref("system");
    });
    return () => sub.remove();
  }, []);
  // Wait a moment for the Geist font (it is bundled, so this is instant on the phone).
  if (!fontsReady && !fontError) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <DialogProvider>
          <AuthProvider>
            <LiveProvider>
              <LiveProfileRefresher />
              <StatusBar style={isDark ? "light" : "dark"} />
              <RootStack />
              <UpdatePrompt />
            </LiveProvider>
          </AuthProvider>
        </DialogProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
