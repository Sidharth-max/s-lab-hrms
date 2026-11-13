import { router, type Href } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { BadgeCheck, CalendarRange, ChevronRight, Download, HandCoins, History, IndianRupee, LogOut, ScanFace, Settings, Smartphone, UserCog, type LucideIcon } from "lucide-react-native";
import { Card, Muted, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { checkForUpdate, installedVersion, useAppUpdate } from "@/lib/update";

function Item({ icon: Icon, label, onPress, badge, danger }: { icon: LucideIcon; label: string; onPress: () => void; badge?: number; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }, pressed && { backgroundColor: C.soft }]}>
      <Icon size={20} color={danger ? C.red : C.text} strokeWidth={1.75} />
      <Text style={{ flex: 1, fontSize: 15, color: danger ? C.red : C.text }}>{label}</Text>
      {badge ? (
        <View style={{ backgroundColor: C.red, borderRadius: 999, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
          <Text style={{ color: C.white, fontSize: 12, fontWeight: "600" }}>{badge}</Text>
        </View>
      ) : null}
      {!danger ? <ChevronRight size={18} color={C.muted} /> : null}
    </Pressable>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.line }} />;
}

export default function More() {
  const { me, can, signOut, scannerMode } = useAuth();
  const go = (href: Href) => () => router.push(href);
  const update = useAppUpdate();
  const [checking, setChecking] = useState(false);
  const isOwner = me?.user.role === "OWNER";
  const admin = can("devices.register") || can("settings.manage") || isOwner;
  return (
    <Screen>
      <Card style={{ padding: 0, gap: 0 }}>
        <Item icon={BadgeCheck} label="Approvals" badge={me?.pendingApprovals} onPress={go("/approvals")} />
        <Divider />
        <Item icon={HandCoins} label="Advances" onPress={go("/advances")} />
        <Divider />
        <Item icon={IndianRupee} label="Salary" onPress={go("/payroll")} />
        <Divider />
        <Item icon={CalendarRange} label="Attendance register" onPress={go("/register")} />
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
            if (update) return void Linking.openURL(update.url);
            setChecking(true);
            const u = await checkForUpdate(true);
            setChecking(false);
            if (u) Alert.alert("New version " + u.name, "Download and install it now?", [{ text: "Later" }, { text: "Download", onPress: () => void Linking.openURL(u.url) }]);
            else Alert.alert("You have the latest version", `Version ${installedVersion.name}`);
          }}
        />
        <Divider />
        <Item
          icon={LogOut}
          danger
          label={scannerMode ? "Log out (back to scanner)" : "Log out"}
          onPress={() => Alert.alert("Log out?", undefined, [{ text: "Cancel" }, { text: "Log out", style: "destructive", onPress: async () => { await signOut(); router.replace("/"); } }])}
        />
      </Card>
      <Muted style={{ textAlign: "center" }}>
        {me?.user.name} · {me?.user.role === "OWNER" ? "Owner" : "Manager"} · version {installedVersion.name}
      </Muted>
    </Screen>
  );
}
