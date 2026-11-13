import { useEffect, useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import Animated, { FadeIn, LinearTransition, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentProps } from "react";
import type { Tabs } from "expo-router";
import { Text } from "./Text";
import { CalendarDays, Grid, House, HouseFilled, Search, Users, Wallet, type IconType } from "./icons";
import { C, shadow } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { RAIL_WIDTH } from "@/lib/layout";
import { openMore, openSearch, useOverlay } from "@/lib/moreSheet";
import { useAuth } from "@/lib/auth";
import { PressScale } from "@/lib/motion";

const TABS: Record<string, { label: string; icon: IconType; active?: IconType }> = {
  index: { label: "Today", icon: House, active: HouseFilled },
  employees: { label: "Employees", icon: Users },
  attendance: { label: "Attendance", icon: CalendarDays },
  salary: { label: "Salary", icon: Wallet },
};

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const LAYOUT = LinearTransition.springify().damping(20).stiffness(260).reduceMotion(ReduceMotion.System);

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", () => setOpen(true));
    const b = Keyboard.addListener("keyboardDidHide", () => setOpen(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return open;
}

function Dot({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <View style={{ position: "absolute", top: -4, right: -8, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.red, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.card }}>
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{n > 9 ? "9+" : n}</Text>
    </View>
  );
}

/**
 * The app's navigation (reference: images 2 and 4).
 * Phones: a floating pill bar in the thumb zone. The open tab grows into a tinted pill with its
 * label; the others are icons. The round Search button sits right next to it, so search is
 * reachable with one thumb. More opens a bottom sheet (it is not a page, so Back just closes it).
 * Open foldable / tablet: the same items as a vertical navigation rail on the left (leading) edge
 * (Samsung: "use a navigation rail on Z Fold in portrait"; Material: rail at the leading edge).
 */
export function AppTabBar({ state, descriptors, emitter, navigateToTab, rail }: BottomTabBarProps & { rail: boolean }) {
  const insets = useSafeAreaInsets();
  const overlay = useOverlay();
  const { me } = useAuth();
  const keyboard = useKeyboardOpen();
  const routes = state.routes.filter((r) => TABS[r.name]);

  const press = (key: string, focused: boolean) => {
    haptic.select();
    const event = emitter.emit({ type: "tabPress", target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigateToTab(key);
  };

  const items = routes.map((route) => {
    const focused = state.routes[state.index]?.key === route.key && overlay !== "more";
    const t = TABS[route.name];
    const Icon = focused && t.active ? t.active : t.icon;
    return { route, focused, t, Icon, options: descriptors[route.key]?.options };
  });

  if (rail) {
    return (
      <View style={{ width: RAIL_WIDTH, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, backgroundColor: C.card, borderRightWidth: 1, borderRightColor: C.hairline, alignItems: "center", gap: 6 }}>
        <PressScale onPress={openSearch} accessibilityRole="button" accessibilityLabel="Search" style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.head, alignItems: "center", justifyContent: "center", marginBottom: 18, ...shadow(2) }}>
          <Search size={24} color={C.headText} />
        </PressScale>
        {items.map(({ route, focused, t, Icon }) => (
          <Pressable key={route.key} onPress={() => press(route.key, focused)} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={t.label} style={{ alignItems: "center", gap: 4, paddingVertical: 6, width: RAIL_WIDTH }}>
            <View style={{ width: 56, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: focused ? C.brandSoft : "transparent" }}>
              <Icon size={22} color={focused ? C.brandInk : C.muted} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: focused ? "700" : "500", color: focused ? C.brandInk : C.muted }} numberOfLines={1}>{t.label}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => { haptic.select(); openMore(); }} accessibilityRole="button" accessibilityLabel="More" style={{ alignItems: "center", gap: 4, paddingVertical: 6, width: RAIL_WIDTH }}>
          <View style={{ width: 56, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: overlay === "more" ? C.brandSoft : "transparent" }}>
            <Grid size={22} color={overlay === "more" ? C.brandInk : C.muted} />
            <Dot n={me?.pendingApprovals} />
          </View>
          <Text style={{ fontSize: 11, fontWeight: "500", color: C.muted }}>More</Text>
        </Pressable>
      </View>
    );
  }

  if (keyboard) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: Math.max(insets.bottom, 10) + 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <View style={{ flex: 1, maxWidth: 460, height: 64, borderRadius: 32, backgroundColor: C.card, borderWidth: 1, borderColor: C.hairline, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, ...shadow(3) }}>
        {items.map(({ route, focused, t, Icon }) => (
          <Animated.View key={route.key} layout={LAYOUT} style={{ flexGrow: focused ? 1 : 0, maxWidth: focused ? 170 : 52 }}>
            <Pressable
              onPress={() => press(route.key, focused)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t.label}
              style={{ height: 52, minWidth: 52, borderRadius: 26, paddingHorizontal: focused ? 16 : 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: focused ? C.brandSoft : "transparent" }}
            >
              <Icon size={23} color={focused ? C.brandInk : C.muted} />
              {focused ? (
                <Animated.Text entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: C.brandInk }}>
                  {t.label}
                </Animated.Text>
              ) : null}
            </Pressable>
          </Animated.View>
        ))}
        <Pressable onPress={() => { haptic.select(); openMore(); }} accessibilityRole="button" accessibilityLabel={me?.pendingApprovals ? `More, ${me.pendingApprovals} waiting for approval` : "More"} style={{ height: 52, width: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: overlay === "more" ? C.brandSoft : "transparent" }}>
          <View>
            <Grid size={23} color={overlay === "more" ? C.brandInk : C.muted} />
            <Dot n={me?.pendingApprovals} />
          </View>
        </Pressable>
      </View>
      <PressScale onPress={openSearch} accessibilityRole="button" accessibilityLabel="Search" scaleTo={0.92} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.head, alignItems: "center", justifyContent: "center", ...shadow(3) }}>
        <Search size={25} color={C.headText} />
      </PressScale>
    </View>
  );
}
