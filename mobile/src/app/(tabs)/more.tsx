import { router, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/Text";
import { BadgeCheck, CalendarRange, ChevronRight, Download, HandCoins, History, LogOut, ScanFace, Settings, Smartphone, UserCog, type IconType, CalendarCheck } from "@/components/icons";
import { Card, Muted, Segmented } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { closeMore } from "@/lib/moreSheet";
import { C, setThemePref, themePref } from "@/lib/theme";
import { checkForUpdate, installedVersion, startUpdate, useAppUpdate } from "@/lib/update";
import { useDialog } from "@/components/dialog";

/**
 * The "More" tab is not a screen: tapping it opens a bottom sheet (see _layout).
 * This file is the sheet's content — the same sections, order, badges and
 * permission gating as the website's mobile "More" sheet.
 */

function Item({ icon: Icon, label, onPress, badge, danger }: { icon: IconType; label: string; onPress: () => void; badge?: number; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }, pressed && { backgroundColor: C.soft }]}>
      <Icon size={20} color={danger ? C.red : C.text} />
      <Text style={{ flex: 1, fontSize: 15, color: danger ? C.red : C.text }}>{label}</Text>
      {badge ? (
        <View style={{ backgroundColor: C.red, borderRadius: 6, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
          <Text style={{ color: C.white, fontSize: 12, fontWeight: "600" }}>{badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={18} color={C.muted} />
    </Pressable>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.line }} />;
}

export default function MoreMenu() {
  const dialog = useDialog();
  const { me, can, signOut, scannerMode } = useAuth();
  const update = useAppUpdate();
  const [checking, setChecking] = useState(false);
  const isOwner = me?.user.role === "OWNER";
  const admin = can("devices.register") || can("settings.manage") || isOwner;
  const go = (href: Href) => () => {
    closeMore();
    router.push(href);
  };
  return (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      <Card style={{ padding: 0, gap: 0 }}>
        <Item icon={BadgeCheck} label="Approvals" badge={me?.pendingApprovals} onPress={go("/approvals")} />
        <Divider />
        <Item icon={HandCoins} label="Advances" onPress={go("/advances")} />
        <Divider />
        <Item icon={CalendarRange} label="Attendance register" onPress={go("/register")} />
        <Divider />
        <Item icon={CalendarCheck} label="Leave" onPress={go("/leaves")} />
      </Card>
      {admin ? (
        <Card style={{ padding: 0, gap: 0 }}>
          {can("devices.register") ? (
            <>
              <Item icon={ScanFace} label={scannerMode ? "Face scanner (this device)" : "Use this device as face scanner"} onPress={go("/scanner-setup")} />
              <Divider />
              <Item icon={Smartphone} label="Scanner devices" onPress={go("/devices")} />
            </>
          ) : null}
          {can("settings.manage") ? (
            <>
              {can("devices.register") ? <Divider /> : null}
              <Item icon={Settings} label="Settings" onPress={go("/settings")} />
            </>
          ) : null}
          {isOwner ? (
            <>
              {can("devices.register") || can("settings.manage") ? <Divider /> : null}
              <Item icon={UserCog} label="Managers" onPress={go("/team")} />
              <Divider />
              <Item icon={History} label="History" onPress={go("/history")} />
            </>
          ) : null}
        </Card>
      ) : null}
      <Card style={{ padding: 0, gap: 0 }}>
        <Item
          icon={Download}
          label={update ? `Update to version ${update.name}` : checking ? "Checking for updates…" : "Check for updates"}
          badge={update ? 1 : undefined}
          onPress={async () => {
            if (update) return startUpdate(update);
            setChecking(true);
            const u = await checkForUpdate(true);
            setChecking(false);
            if (u) startUpdate(u);
            else await dialog.notify({ title: "You have the latest version", message: `Version ${installedVersion.name}`, tone: "green" });
          }}
        />
        <Divider />
        <Item
          icon={LogOut}
          danger
          label={scannerMode ? "Log out (back to scanner)" : "Log out"}
          onPress={async () => { if (await dialog.confirm({ title: "Log out?", confirmText: "Log out", danger: true })) { await signOut(); router.replace("/"); } }}
        />
      </Card>
      <Card>
        <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Appearance</Text>
        <Segmented
          options={[{ value: "system", label: "Phone setting" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
          value={themePref}
          onChange={(v) => { if (v !== themePref) void setThemePref(v); }}
        />
      </Card>
      <Muted style={{ textAlign: "center" }}>
        {me?.user.name} · {me?.user.role === "OWNER" ? "Owner" : "Manager"} · version {installedVersion.name}
      </Muted>
    </View>
  );
}
