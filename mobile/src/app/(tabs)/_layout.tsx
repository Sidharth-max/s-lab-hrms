import { Redirect, Tabs } from "expo-router";
import { Pressable, View, type PressableProps } from "react-native";
import { CalendarDays, House, IndianRupee, Menu, Users } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { FONT } from "@/components/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/lib/theme";

/**
 * Tab buttons with no press feedback: no Android ripple hue, no opacity dip.
 * The active tab already shows through its tint color; a flash on every tap is noise.
 */
function FlatTabButton({ onPress, onLongPress, accessibilityState, accessibilityLabel, testID, style, children }: PressableProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      testID={testID}
      android_ripple={{ color: "transparent" }}
      style={(state) => [typeof style === "function" ? style(state) : style, { opacity: 1 }]}
    >
      {children}
    </Pressable>
  );
}

export default function TabsLayout() {
  const { ready, me, scannerMode } = useAuth();
  const insets = useSafeAreaInsets();
  if (ready && !me) return <Redirect href={scannerMode ? "/scanner" : "/login"} />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.text,
        tabBarInactiveTintColor: C.muted,
        // One floating pill bar, pinned to the bottom on every screen size.
        // left/right 16 matches the card padding, so the bar lines up with the cards.
        tabBarPosition: "bottom",
        tabBarButton: FlatTabButton,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 12) + 8,
          height: 68,
          paddingHorizontal: 8,
          paddingTop: 8,
          paddingBottom: 8,
          borderRadius: 34,
          borderWidth: 1,
          borderColor: C.hairline,
          backgroundColor: C.white,
          elevation: 8,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        },
        tabBarItemStyle: { borderRadius: 26 },
        tabBarLabelStyle: { fontSize: 11, fontFamily: FONT.medium, marginTop: 2 },
        tabBarIconStyle: { marginBottom: -2 },
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
      <Tabs.Screen name="salary" options={{ title: "Salary", tabBarLabel: "Salary", tabBarIcon: ({ color, size }) => <IndianRupee color={color as string} size={size} /> }} />
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
