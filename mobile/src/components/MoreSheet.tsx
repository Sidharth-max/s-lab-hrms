import { router, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { BadgeCheck, Beach, CalendarRange, Coins, Download, History, LogOut, ScanFace, Settings, Smartphone, UserCog, type IconType } from "./icons";
import { Sheet } from "./Sheet";
import { Segmented } from "./ui";
import { useDialog } from "./dialog";
import { useAuth } from "@/lib/auth";
import { C, setThemePref, themePref, type Ink } from "@/lib/theme";
import { checkForUpdate, installedVersion, startUpdate, useAppUpdate } from "@/lib/update";
import { closeOverlay, useOverlay } from "@/lib/moreSheet";
import { PressScale } from "@/lib/motion";

function Tile({ icon: Icon, label, ink, badge, onPress }: { icon: IconType; label: string; ink: Ink; badge?: number; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge} waiting` : label} style={{ flex: 1, minWidth: "30%", backgroundColor: C.soft, borderRadius: 20, padding: 14, gap: 10, minHeight: 96 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: C.tint[ink], alignItems: "center", justifyContent: "center" }}>
          <Icon size={21} color={C.ink[ink]} />
        </View>
        {badge ? (
          <View style={{ backgroundColor: C.red, borderRadius: 10, minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }} numberOfLines={2}>{label}</Text>
    </PressScale>
  );
}

/**
 * "More" menu as a bottom sheet (like the website's mobile menu). It opens over the current tab and
 * closes with Back, a tap outside, a drag down, or by choosing an item. Being an overlay rather
 * than a screen fixes the old bugs: tapping More no longer swaps the page, and Back never pops
 * past the tabs (which used to drop the user on the login / scanner screen = "logged out").
 */
export function MoreSheet() {
  const overlay = useOverlay();
  const dialog = useDialog();
  const { me, can, signOut, scannerMode } = useAuth();
  const update = useAppUpdate();
  const [checking, setChecking] = useState(false);
  const isOwner = me?.user.role === "OWNER";
  const go = (href: Href) => () => {
    closeOverlay();
    router.push(href);
  };
  const tiles: { icon: IconType; label: string; ink: Ink; href: Href; badge?: number; show: boolean }[] = [
    { icon: BadgeCheck, label: "Approvals", ink: "red", href: "/approvals", badge: me?.pendingApprovals, show: true },
    { icon: Coins, label: "Advances", ink: "orange", href: "/advances", show: true },
    { icon: Beach, label: "Leave", ink: "teal", href: "/leaves", show: true },
    { icon: CalendarRange, label: "Monthly register", ink: "violet", href: "/register", show: true },
    { icon: ScanFace, label: scannerMode ? "Face scanner" : "Use as scanner", ink: "blue", href: "/scanner-setup", show: can("devices.register") },
    { icon: Smartphone, label: "Scanner devices", ink: "blue", href: "/devices", show: can("devices.register") },
    { icon: Settings, label: "Settings", ink: "green", href: "/settings", show: can("settings.manage") },
    { icon: UserCog, label: "Managers", ink: "pink", href: "/team", show: isOwner },
    { icon: History, label: "History", ink: "violet", href: "/history", show: isOwner },
  ];
  const shown = tiles.filter((t) => t.show);

  return (
    <Sheet visible={overlay === "more"} onClose={closeOverlay} title="More">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {shown.map((t) => <Tile key={String(t.href)} icon={t.icon} label={t.label} ink={t.ink} badge={t.badge} onPress={go(t.href)} />)}
        {/* Fill the last row so tiles keep the same width. */}
        {Array.from({ length: (3 - (shown.length % 3)) % 3 }, (_, i) => <View key={`pad${i}`} style={{ flex: 1, minWidth: "30%" }} />)}
      </View>

      <View style={{ backgroundColor: C.soft, borderRadius: 20, padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: C.muted }}>Appearance</Text>
        <Segmented
          options={[{ value: "system", label: "Phone setting" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
          value={themePref}
          onChange={(v) => { if (v !== themePref) void setThemePref(v); }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <PressScale
          onPress={async () => {
            if (update) return startUpdate(update);
            setChecking(true);
            const u = await checkForUpdate(true);
            setChecking(false);
            if (u) startUpdate(u);
            else await dialog.notify({ title: "You have the latest version", message: `Version ${installedVersion.name}`, tone: "green" });
          }}
          accessibilityRole="button"
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.soft, borderRadius: 18, padding: 14 }}
        >
          <Download size={20} color={update ? C.ink.green : C.text} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: update ? C.ink.green : C.text }} numberOfLines={2}>
            {update ? `Update to ${update.name}` : checking ? "Checking…" : "Check for updates"}
          </Text>
        </PressScale>
        <PressScale
          onPress={async () => {
            if (await dialog.confirm({ title: "Log out?", message: scannerMode ? "This device goes back to the face scanner." : undefined, confirmText: "Log out", danger: true })) {
              closeOverlay();
              await signOut();
            }
          }}
          accessibilityRole="button"
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.tint.red, borderRadius: 18, padding: 14 }}
        >
          <LogOut size={20} color={C.ink.red} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: C.ink.red }}>{scannerMode ? "Log out to scanner" : "Log out"}</Text>
        </PressScale>
      </View>
      <Text style={{ textAlign: "center", fontSize: 12, color: C.muted, paddingBottom: 4 }}>
        {me?.user.name} · {isOwner ? "Owner" : "Manager"} · version {installedVersion.name}
      </Text>
    </Sheet>
  );
}
