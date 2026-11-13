import { Redirect, Tabs } from "expo-router";
import { CalendarDays, House, Menu, Users } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerStyle: { backgroundColor: C.head },
        headerTintColor: C.headText,
        headerTitleStyle: { fontWeight: "600", color: C.headText },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: me?.business.name ?? "Today", tabBarLabel: "Today", tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="employees" options={{ title: "Employees", tabBarIcon: ({ color, size }) => <Users color={color} size={size} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} strokeWidth={1.75} /> }} />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarBadge: me?.pendingApprovals ? me.pendingApprovals : undefined,
          tabBarBadgeStyle: { backgroundColor: C.red },
          tabBarIcon: ({ color, size }) => <Menu color={color} size={size} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
