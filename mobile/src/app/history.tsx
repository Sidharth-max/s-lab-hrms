import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { RefreshControl, SectionList, View } from "react-native";
import { Text } from "@/components/Text";
import { CalendarCheck, HandCoins, History, IndianRupee, Settings, Smartphone, UserCog, Users, type IconType } from "@/components/icons";
import { ErrorView, Hero, Loading, Muted, Tabs } from "@/components/ui";
import { BlurFrame } from "@/components/BlurFrame";
import { api } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

type Area = "employee" | "attendance" | "advance" | "salary" | "settings" | "team" | "device";
interface Item { id: string; at: string; by: string; area: Area; title: string; detail: string | null }

const AREAS: { key: Area | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "employee", label: "Employees" },
  { key: "attendance", label: "Attendance" },
  { key: "advance", label: "Advances" },
  { key: "salary", label: "Salary" },
  { key: "team", label: "Managers" },
  { key: "settings", label: "Settings" },
  { key: "device", label: "Scanners" },
];
const ICON: Record<Area, IconType> = { employee: Users, attendance: CalendarCheck, advance: HandCoins, salary: IndianRupee, team: UserCog, settings: Settings, device: Smartphone };

/** India date key (YYYY-MM-DD) of an ISO time. */
function istKey(iso: string) {
  return new Date(new Date(iso).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
}

export default function HistoryScreen() {
  const { data, error, refreshing, reload } = useLoad(() => api.get<{ items: Item[] }>("/api/m/audit"), [], ["attendance", "employee", "advance", "approval", "salary", "settings", "device"]);
  const [area, setArea] = useState<Area | "all">("all");
  const sections = useMemo(() => {
    const today = istKey(new Date().toISOString());
    const map = new Map<string, Item[]>();
    for (const i of data?.items ?? []) {
      if (area !== "all" && i.area !== area) continue;
      const k = istKey(i.at);
      map.set(k, [...(map.get(k) ?? []), i]);
    }
    return [...map.entries()].map(([k, list]) => ({ title: k === today ? `Today · ${dateLabel(k)}` : dateLabel(k), data: list }));
  }, [data, area]);

  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <>
      <Stack.Screen options={{ title: "History" }} />
      <BlurFrame>{(pad) => (
      <SectionList showsVerticalScrollIndicator={false}
        sections={sections}
        keyExtractor={(i) => i.id}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
        contentContainerStyle={{ padding: 16, paddingTop: 16 + pad, gap: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Hero icon={<History size={24} color="#ffffff" />} eyebrow="History" title="Every change" subtitle="By the owner and managers (latest 200)." />
            <Tabs options={AREAS.map((a) => ({ value: a.key, label: a.label }))} value={area} onChange={setArea} />
          </View>
        }
        ListEmptyComponent={<Muted>Nothing here yet.</Muted>}
        renderSectionHeader={({ section }) => <Text style={{ marginTop: 10, fontSize: 13, fontWeight: "700", color: C.muted }}>{section.title}</Text>}
        renderItem={({ item: i }) => {
          const Icon = ICON[i.area] ?? Settings;
          return (
            <View style={{ flexDirection: "row", gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
                <Icon size={16} color={C.text} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontWeight: "600", color: C.text, fontSize: 14 }}>{i.title}</Text>
                {i.detail ? <Muted>{i.detail}</Muted> : null}
                <Text style={{ fontSize: 12, color: C.muted }}>
                  {new Date(i.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · {i.by}
                </Text>
              </View>
            </View>
          );
        }}
      />
      )}</BlurFrame>
    </>
  );
}
