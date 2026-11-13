import { Redirect, Tabs } from "expo-router";
import { CalendarDays, House, Menu, Users } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { View } from "react-native";
import { FONT } from "@/components/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWide } from "@/lib/layout";
import { C } from "@/lib/theme";

export default function TabsLayout() {
  const { ready, me, scannerMode } = useAuth();
  const wide = useWide();
  const insets = useSafeAreaInsets();
  if (ready && !me) return <Redirect href={scannerMode ? "/scanner" : "/login"} />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.text,
        tabBarInactiveTintColor: C.muted,
        // Phone: a floating rounded bar above the content. Open foldable / tablet: a rail on the left.
        tabBarPosition: wide ? "left" : "bottom",
        tabBarVariant: wide ? "material" : "uikit",
        tabBarStyle: wide
          ? { backgroundColor: C.white, borderRightColor: C.line, borderRightWidth: 1, paddingTop: 8, minWidth: 84 }
          : {
              position: "absolute",
              left: 16,
              right: 16,
              bottom: Math.max(insets.bottom, 10) + 6,
              height: 64,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 32,
              borderTopWidth: 1,
              borderWidth: 1,
              borderColor: C.hairline,
              borderTopColor: C.hairline,
              backgroundColor: C.white,
              elevation: 8,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
            },
        tabBarLabelStyle: { fontSize: 11, fontFamily: FONT.medium },
        headerStyle: { backgroundColor: C.white },
        headerBackground: () => <View style={{ flex: 1, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line }} />,
        headerTintColor: C.text,
        headerTitleStyle: { fontFamily: FONT.bold, fontSize: 20, color: C.text, letterSpacing: -0.4 },
        headerTitleAlign: "left",
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: me?.business.name ?? "Today", tabBarLabel: "Today", tabBarIcon: ({ color, size }) => <House color={color as string} size={size} /> }} />
      <Tabs.Screen name="employees" options={{ title: "Employees", tabBarLabel: "Employees", tabBarIcon: ({ color, size }) => <Users color={color as string} size={size} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarLabel: "Attendance", tabBarIcon: ({ color, size }) => <CalendarDays color={color as string} size={size} /> }} />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarLabel: "More",
          tabBarBadge: me?.pendingApprovals ? me.pendingApprovals : undefined,
          tabBarBadgeStyle: { backgroundColor: C.red },
          tabBarIcon: ({ color, size }) => <Menu color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
