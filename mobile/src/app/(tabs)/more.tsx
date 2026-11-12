import Constants from "expo-constants";
import { router, type Href } from "expo-router";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { BadgeCheck, ChevronRight, Globe, HandCoins, IndianRupee, LogOut, ScanFace, type LucideIcon } from "lucide-react-native";
import { Card, Muted, Screen } from "@/components/ui";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";

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
  return (
    <Screen>
      <Card style={{ padding: 0, gap: 0 }}>
        <Item icon={BadgeCheck} label="Approvals" badge={me?.pendingApprovals} onPress={go("/approvals")} />
        <Divider />
        <Item icon={HandCoins} label="Advances" onPress={go("/advances")} />
        <Divider />
        <Item icon={IndianRupee} label="Salary" onPress={go("/payroll")} />
        {can("devices.register") ? (
          <>
            <Divider />
            <Item icon={ScanFace} label={scannerMode ? "Face scanner (this device)" : "Use this device as face scanner"} onPress={go("/scanner-setup")} />
          </>
        ) : null}
        <Divider />
        <Item icon={Globe} label="Open website (settings, managers, history)" onPress={() => Linking.openURL(API_URL)} />
      </Card>
      <Card style={{ padding: 0, gap: 0 }}>
        <Item
          icon={LogOut}
          danger
          label={scannerMode ? "Log out (back to scanner)" : "Log out"}
          onPress={() => Alert.alert("Log out?", undefined, [{ text: "Cancel" }, { text: "Log out", style: "destructive", onPress: async () => { await signOut(); router.replace("/"); } }])}
        />
      </Card>
      <Muted style={{ textAlign: "center" }}>
        {me?.user.name} · {me?.user.role === "OWNER" ? "Owner" : "Manager"} · version {Constants.expoConfig?.version}
      </Muted>
    </Screen>
  );
}
