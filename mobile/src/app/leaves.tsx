import { Stack } from "expo-router";
import { RefreshControl } from "react-native";
import { LeaveSection } from "@/components/LeaveSection";
import { Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";

interface Emp { id: string; name: string; code: string; site: string; active: boolean }

/** All scheduled leaves: on leave now, upcoming and recent. */
export default function LeavesScreen() {
  const emps = useLoad(() => api.get<{ employees: Emp[] }>("/api/m/employees"), [], ["employee"]);
  return (
    <Screen refreshControl={<RefreshControl refreshing={emps.refreshing} onRefresh={emps.reload} />}>
      <Stack.Screen options={{ title: "Leave" }} />
      <LeaveSection employees={(emps.data?.employees ?? []).filter((e) => e.active)} />
    </Screen>
  );
}
