import { Redirect, Tabs } from "expo-router";
import { Pressable, View, type PressableProps } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { CalendarDays, House, IndianRupee, Menu, Users, X } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { FONT } from "@/components/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FLOATING_NAV_SPACE } from "@/lib/layout";
import { closeMore, openMore, useMoreOpen } from "@/lib/moreSheet";
import { C } from "@/lib/theme";
import MoreMenu from "./more";

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

/** The "More" bottom sheet: same rows as the website's mobile menu, opened by the More tab. */
function MoreSheet() {
  return (
    <View style={{ position: "absolute", inset: 0 }} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(160)} style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.32)" }}>
        <Pressable accessible accessibilityLabel="Close menu" onPress={closeMore} style={{ position: "absolute", inset: 0 }} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().damping(22)}
        exiting={SlideOutDown.duration(180)}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderTopWidth: 1,
          borderColor: C.line,
          backgroundColor: C.white,
          paddingTop: 10,
          paddingHorizontal: 12,
          paddingBottom: FLOATING_NAV_SPACE + 16,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -4 },
          elevation: 16,
        }}
      >
        <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: C.track, marginBottom: 2 }} />
        <MoreMenu />
      </Animated.View>
    </View>
  );
}

export default function TabsLayout() {
  const { ready, me, scannerMode } = useAuth();
  const insets = useSafeAreaInsets();
  const moreOpen = useMoreOpen();
  if (ready && !me) return <Redirect href={scannerMode ? "/scanner" : "/login"} />;
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: C.text,
          tabBarInactiveTintColor: C.muted,
          // One floating pill bar, pinned to the bottom on every screen size.
          // (An earlier left-rail variant fired on large phones and broke the UI.)
          tabBarPosition: "bottom",
          tabBarButton: FlatTabButton,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            position: "absolute",
            left: 20,
            right: 20,
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
            tabBarIcon: ({ color, size }) => (moreOpen ? <X color={color as string} size={size} /> : <Menu color={color as string} size={size} />),
          }}
          listeners={{
            tabPress: (e) => {
              // The More tab opens the sheet instead of navigating; a second tap (X) closes it.
              e.preventDefault();
              if (moreOpen) closeMore();
              else openMore();
            },
          }}
        />
      </Tabs>
      {moreOpen ? <MoreSheet /> : null}
    </View>
  );
}
