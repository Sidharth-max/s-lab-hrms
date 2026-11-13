import { Tabs } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/lib/auth";
import { FONT } from "@/components/Text";
import { C } from "@/lib/theme";
import { useWindowLayout } from "@/lib/layout";
import { AppTabBar } from "@/components/NavBar";
import { MoreSheet } from "@/components/MoreSheet";
import { SearchSheet } from "@/components/SearchSheet";

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
        tabBar={(props) => <AppTabBar {...props} rail={layout.rail} />}
        screenOptions={{
          tabBarPosition: layout.rail ? "right" : "bottom",
          animation: "shift",
          headerStyle: { backgroundColor: C.bg },
          headerBackground: () => <View style={{ flex: 1, backgroundColor: C.bg }} />,
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
