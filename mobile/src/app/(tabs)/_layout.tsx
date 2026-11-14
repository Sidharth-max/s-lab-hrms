import { Tabs } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/lib/auth";
import { FONT } from "@/components/Text";
import { C } from "@/lib/theme";
import { useWindowLayout } from "@/lib/layout";
import { AppTabBar } from "@/components/NavBar";
import { MoreSheet } from "@/components/MoreSheet";
import { SearchSheet } from "@/components/SearchSheet";
import { TabFade } from "@/lib/motion";

/**
 * Main tabs. Back behaviour:
 *  - a sheet is open (More / Search): Back closes it (the sheet is a Modal);
 *  - another tab is open: Back goes to Today (Material's rule for top-level destinations);
 *  - Today is open: ONE Back closes the app (see useExitOnBack in the Today screen).
 * The login / scanner screens are never under the tabs in the history (Stack.Protected in the
 * root layout), so Back can no longer drop the user on the login page ("logged out").
 */
export default function TabsLayout() {
  const { me } = useAuth();
  const layout = useWindowLayout();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Tabs
        backBehavior="firstRoute"
        // No cross-fade (it overlapped both tabs); the opened tab fades in by itself.
        screenLayout={({ children, navigation }) => <TabFade navigation={navigation}>{children}</TabFade>}
        tabBar={(props) => <AppTabBar {...props} rail={layout.rail} />}
        screenOptions={{
          tabBarPosition: layout.rail ? "left" : "bottom",
          animation: "none",
          // Hidden tabs do not re-render on live updates (keeps the open tab smooth).
          freezeOnBlur: true,
          // Transparent header: the list scrolls underneath and BlurFrame frosts the header + status bar.
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
          headerBackground: () => null,
          headerTintColor: C.text,
          headerTitleStyle: { fontFamily: FONT.bold, fontSize: 24, color: C.text, letterSpacing: -0.6 },
          headerTitleAlign: "left",
          headerShadowVisible: false,
          sceneStyle: { backgroundColor: C.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: me?.business.name ?? "Today", headerShown: false }} />
        <Tabs.Screen name="employees" options={{ title: "Employees" }} />
        <Tabs.Screen name="attendance" options={{ title: "Attendance" }} />
        <Tabs.Screen name="salary" options={{ title: "Salary" }} />
      </Tabs>
      <MoreSheet />
      <SearchSheet />
    </View>
  );
}
