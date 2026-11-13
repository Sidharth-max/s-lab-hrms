import { Stack } from "expo-router";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { ErrorView, Loading, Muted } from "@/components/ui";
import { api } from "@/lib/api";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Log { id: string; at: string; by: string; action: string; detail: unknown }

const LABELS: Record<string, string> = {
  "employee.create": "Added employee",
  "employee.update": "Edited employee",
  "employee.left": "Marked employee as left",
  "employee.rejoin": "Made employee active again",
  "employee.login.on": "Turned on web login",
  "employee.login.off": "Turned off web login",
  "face.enroll": "Enrolled face",
  "face.remove": "Removed face",
  "attendance.override": "Set day status",
  "attendance.override.clear": "Day back to automatic",
  "attendance.punch.add": "Added missed punch",
  "attendance.punch.void": "Removed punch",
  "advance.create": "Gave advance",
  "approval.approve": "Approved",
  "approval.reject": "Rejected",
  "approval.otp": "Approved by owner OTP",
  "payroll.recalculate": "Calculated salary",
  "payroll.lock": "Locked salary",
  "payroll.reopen": "Reopened salary",
  "payroll.adjustment": "Added salary adjustment",
  "payroll.payment": "Recorded payment",
  "settings.update": "Changed settings",
  "site.create": "Added site",
  "holiday.add": "Added holiday",
  "holiday.remove": "Removed holiday",
  "manager.create": "Added manager",
  "manager.update": "Edited manager",
  "device.register": "Registered scanner",
  "device.revoke": "Removed scanner",
};

export default function HistoryScreen() {
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ logs: Log[] }>("/api/m/audit"), [], ["attendance", "employee", "advance", "approval", "payroll", "settings", "device"]);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <>
      <Stack.Screen options={{ title: "History" }} />
      <FlatList
        data={data.logs}
        keyExtractor={(l) => l.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListHeaderComponent={<Muted>Every change by the owner and managers (latest 200).</Muted>}
        renderItem={({ item: l }) => (
          <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, gap: 2 }}>
            <Text style={{ fontWeight: "600", color: C.text }}>{LABELS[l.action] ?? l.action}</Text>
            <Muted>{l.by} · {new Date(l.at).toLocaleString("en-IN")}</Muted>
          </View>
        )}
      />
    </>
  );
}
