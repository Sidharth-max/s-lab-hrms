import { Redirect, Tabs } from "expo-router";
import { CalendarDays, House, Menu, Users } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { View } from "react-native";
import { FONT } from "@/components/Text";
import { C } from "@/lib/theme";

export default function TabsLayout() {
  const { ready, me, scannerMode } = useAuth();
  if (ready && !me) return <Redirect href={scannerMode ? "/scanner" : "/login"} />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.text,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { borderTopColor: C.line, backgroundColor: C.white },
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
      <Tabs.Screen name="employees" options={{ title: "Employees", tabBarIcon: ({ color, size }) => <Users color={color as string} size={size} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarIcon: ({ color, size }) => <CalendarDays color={color as string} size={size} /> }} />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarBadge: me?.pendingApprovals ? me.pendingApprovals : undefined,
          tabBarBadgeStyle: { backgroundColor: C.red },
          tabBarIcon: ({ color, size }) => <Menu color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
