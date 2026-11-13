import { router } from "expo-router";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { Badge, Card, ErrorView, Loading, Muted, Notice, Screen, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { C, statusTone } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { useWide } from "@/lib/layout";
import { TwoPane } from "@/components/TwoPane";
import { useLive } from "@/lib/live";

interface Dashboard {
  date: string;
  storeHours: { open: string; close: string; anyScanFullDay: boolean } | null;
  counts: { total: number; present: number; inside: number; notIn: number; pendingApprovals: number };
  rows: { id: string; name: string; code: string; site: string; status: string; statusLabel: string; inAt: string | null; outAt: string | null; inside: boolean; manual: boolean; needsFace: boolean }[];
}

function Stat({ label, value, of, tone }: { label: string; value: number; of?: number; tone?: "red" }) {
  return (
    <Card style={{ gap: 4, ...(tone === "red" ? { backgroundColor: C.redSoft, borderColor: C.redLine } : {}) }}>
      <Muted>{label}</Muted>
      <Text style={{ fontSize: 26, fontWeight: "700", color: C.text, letterSpacing: -0.5, fontVariant: ["tabular-nums"] }}>
        {value}
        {of != null ? <Text style={{ fontSize: 15, fontWeight: "400", color: C.muted }}> / {of}</Text> : null}
      </Text>
    </Card>
  );
}

export default function Today() {
  const { connected } = useLive();
  const wide = useWide();
  const { data, error, refreshing, reload } = useLoad(() => api.get<Dashboard>("/api/m/dashboard"), [], ["attendance", "employee", "approval"]);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const needFace = data.rows.filter((r) => r.needsFace);

  const summary = (
    <>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>Today · {dateLabel(data.date)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }} accessibilityLabel={connected ? "Live updates on" : "Live updates off"}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? C.green : C.line }} />
            <Text style={{ fontSize: 12, color: C.muted }}>{connected ? "Live" : "Offline"}</Text>
          </View>
        </View>
        <Muted>
          {data.storeHours ? `Store hours ${data.storeHours.open} to ${data.storeHours.close}${data.storeHours.anyScanFullDay ? " · any scan = full day" : ""}` : "Weekly off today"}
        </Muted>
      </View>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Stat label="Present" value={data.counts.present} of={data.counts.total} /></View>
          <View style={{ flex: 1 }}><Stat label="Still inside" value={data.counts.inside} /></View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Stat label="Not in yet" value={data.counts.notIn} /></View>
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/approvals")} accessibilityRole="button">
            <Stat label="Waiting approval" value={data.counts.pendingApprovals} tone={data.counts.pendingApprovals ? "red" : undefined} />
          </Pressable>
        </View>
      </View>
      {needFace.length ? <Notice tone="red" text={`${needFace.length} employee(s) need a face photo before they can use the scanner.`} /> : null}
    </>
  );
  const people = (
      <Card style={{ padding: 0, gap: 0 }}>
        {data.rows.length === 0 ? <View style={{ padding: 16, gap: 12, alignItems: "flex-start" }}><Muted>No employees yet. Add your staff to see the attendance for today here.</Muted><Button title="Add employee" onPress={() => router.push("/employee/new")} /></View> : null}
        {data.rows.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId: r.id, date: data.date } })}
            style={({ pressed }) => [{ padding: 14, gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }, pressed && { backgroundColor: C.soft }]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, flexShrink: 1 }}>
                {r.name} <Text style={{ color: C.muted, fontWeight: "400" }}>{r.code}</Text>
              </Text>
              <Badge label={r.statusLabel || "—"} tone={r.status === "ABSENT" ? "neutral" : statusTone(r.status)} dot />
            </View>
            <Muted>
              {r.site} · In {r.inAt ?? "—"} · Out {r.outAt ?? (r.inside ? "inside" : "—")}
              {r.manual ? " · manual" : ""}
            </Muted>
          </Pressable>
        ))}
      </Card>
  );
  const refresh = <RefreshControl refreshing={refreshing} onRefresh={reload} />;
  // Open foldable / tablet: numbers on the left, people on the right.
  if (wide) return <TwoPane left={<Screen tabs refreshControl={refresh}>{summary}</Screen>} right={<Screen tabs refreshControl={refresh}>{people}</Screen>} />;
  return (
    <Screen tabs refreshControl={refresh}>
      {summary}
      {people}
    </Screen>
  );
}
