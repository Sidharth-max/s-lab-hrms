import { router } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { BlurTargetView } from "expo-blur";
import { BlurStrip } from "@/components/BlurFrame";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/Text";
import { ArrowUpRight, BadgeCheck, Building, Camera, ChevronRight, Clock, UserPlus, Users } from "@/components/icons";
import { Avatar, Badge, Button, Card, ErrorView, InkText, Loading, Muted, refreshProps, SectionLabel } from "@/components/ui";
import { ArrivalsChart, DotGauge, GradientFill, SegmentBar, siteInk } from "@/components/Viz";
import { api } from "@/lib/api";
import { dateLabel, rs } from "@/lib/format";
import { C, shadow, statusTone } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { FLOATING_NAV_SPACE, RAIL_WIDTH, useWindowLayout } from "@/lib/layout";
import { useLive } from "@/lib/live";
import { useAuth } from "@/lib/auth";
import { rememberNames } from "@/lib/names";
import { useExitOnBack } from "@/lib/back";
import { Animated, CountUp, enterAt, PressScale } from "@/lib/motion";

// Same data model as the website's dashboard (server: src/lib/dashboard.ts).
interface Dashboard {
  date: string;
  greeting: string;
  storeHours: { open: string; close: string; anyScanFullDay: boolean } | null;
  counts: { total: number; present: number; inside: number; notIn: number; pendingApprovals: number };
  sites: { id: string; name: string; total: number; present: number; inside: number; notIn: number }[];
  arrivals: { hour: number; count: number }[];
  payroll: { toPay: number; owed: number; people: number } | null;
  rows: { id: string; name: string; code: string; site: string; status: string; statusLabel: string; inAt: string | null; outAt: string | null; inside: boolean; manual: boolean; needsFace: boolean }[];
  noFace: { id: string; name: string }[];
}

const openDay = (r: Dashboard["rows"][number], date: string) =>
  router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId: r.id, date, name: r.name } });

function LiveDot({ light }: { light?: boolean }) {
  const { connected } = useLive();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: light ? "rgba(255,255,255,0.18)" : C.track }} accessibilityLabel={connected ? "Live updates on" : "Live updates off"}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: connected ? "#4ade80" : light ? "rgba(255,255,255,0.5)" : C.faint }} />
      <Text style={{ fontSize: 12, fontWeight: "600", color: light ? "#fff" : C.muted }}>{connected ? "Live" : "Offline"}</Text>
    </View>
  );
}

/** Mini stat on the gradient hero. */
function HeroStat({ label, value, onPress, alert }: { label: string; value: number; onPress?: () => void; alert?: boolean }) {
  const body = (
    <View style={{ flex: 1, backgroundColor: alert ? "rgba(239,68,68,0.32)" : "rgba(255,255,255,0.16)", borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12, gap: 2 }}>
      <CountUp value={value} style={{ color: "#fff", fontSize: 22, fontWeight: "700" }} />
      <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "500" }} numberOfLines={1}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable style={{ flex: 1 }} onPress={onPress} accessibilityRole="button">{body}</Pressable> : <View style={{ flex: 1 }}>{body}</View>;
}

function PersonRow({ r, date, i }: { r: Dashboard["rows"][number]; date: string; i: number }) {
  return (
    <Animated.View entering={enterAt(i)}>
      <Pressable onPress={() => openDay(r, date)} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.hairline }, pressed && { backgroundColor: C.soft }]}>
        <Avatar name={r.name} size={40} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }} numberOfLines={1}>{r.name} <Text style={{ color: C.muted, fontWeight: "400" }}>{r.code}</Text></Text>
          <Text style={{ fontSize: 13, color: C.muted }} numberOfLines={2}>
            {r.site} · In <Text style={{ color: r.inAt ? C.ink.teal : C.muted, fontWeight: r.inAt ? "600" : "400" }}>{r.inAt ?? "—"}</Text> · Out{" "}
            <Text style={{ color: r.outAt ? C.ink.blue : r.inside ? C.ink.teal : C.muted, fontWeight: r.outAt || r.inside ? "600" : "400" }}>{r.outAt ?? (r.inside ? "inside" : "—")}</Text>
            {r.manual ? " · manual" : ""}
          </Text>
        </View>
        <Badge label={r.statusLabel || "—"} tone={r.status === "ABSENT" ? "neutral" : statusTone(r.status)} dot />
      </Pressable>
    </Animated.View>
  );
}

function PeopleCard({ data }: { data: Dashboard }) {
  return (
    <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, paddingBottom: 6 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>Who is in</Text>
        <Muted>{data.counts.present} of {data.counts.total}</Muted>
      </View>
      {data.rows.length === 0 ? (
        <View style={{ padding: 16, gap: 12, alignItems: "flex-start" }}>
          <Muted>No employees yet. Add your staff to see today&apos;s attendance here.</Muted>
          <Button title="Add employee" icon={<UserPlus size={18} color="#ffffff" />} onPress={() => router.push("/employee/new")} />
        </View>
      ) : null}
      {data.rows.map((r, i) => <PersonRow key={r.id} r={r} date={data.date} i={i} />)}
    </Card>
  );
}

function SitesCard({ data }: { data: Dashboard }) {
  if (!data.sites.length) return null;
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>Sites</Text>
        <Muted>present / staff</Muted>
      </View>
      <SegmentBar parts={data.sites.map((s, i) => ({ value: s.total, ink: siteInk(i) }))} />
      {data.sites.map((s, i) => (
        <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
          <View style={{ width: 4, height: 30, borderRadius: 2, backgroundColor: C.ink[siteInk(i)] }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }} numberOfLines={1}>{s.name}</Text>
            <Text style={{ fontSize: 12, color: C.muted }}>{s.inside} inside · {s.notIn} not in yet</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.ink[siteInk(i)], fontVariant: ["tabular-nums"] }}>{s.present}<Text style={{ color: C.muted, fontWeight: "400", fontSize: 14 }}> / {s.total}</Text></Text>
        </View>
      ))}
    </Card>
  );
}

function PayrollCard({ p }: { p: NonNullable<Dashboard["payroll"]> }) {
  return (
    <PressScale onPress={() => router.navigate("/salary")} accessibilityRole="button" style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.hairline, padding: 16, gap: 6, ...shadow(1) }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: C.muted }}>Salary to pay</Text>
        <ArrowUpRight size={18} color={C.muted} />
      </View>
      <CountUp value={p.toPay} format={(n) => rs(Math.round(n / 100) * 100)} style={{ fontSize: 28, fontWeight: "700", color: C.ink.green, letterSpacing: -0.8 }} />
      <Text style={{ fontSize: 13, color: C.muted }}>
        {p.people} {p.people === 1 ? "person" : "people"} due{p.owed > 0 ? <Text> · <Text style={{ color: C.ink.red, fontWeight: "600" }}>{rs(p.owed)}</Text> owed by staff</Text> : null}
      </Text>
    </PressScale>
  );
}

function Alerts({ data }: { data: Dashboard }) {
  return (
    <>
      {data.counts.pendingApprovals ? (
        <PressScale onPress={() => router.push("/approvals")} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.tint.red, borderRadius: 18, padding: 14 }}>
          <BadgeCheck size={22} color={C.ink.red} />
          <Text style={{ flex: 1, color: C.ink.red, fontWeight: "600", fontSize: 14 }}>{data.counts.pendingApprovals} advance{data.counts.pendingApprovals === 1 ? "" : "s"} waiting for your approval</Text>
          <ChevronRight size={18} color={C.ink.red} />
        </PressScale>
      ) : null}
      {data.noFace.length ? (
        <PressScale onPress={() => router.push({ pathname: "/employee/[id]", params: { id: data.noFace[0].id, name: data.noFace[0].name } })} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.tint.amber, borderRadius: 18, padding: 14 }}>
          <Camera size={22} color={C.ink.amber} />
          <Text style={{ flex: 1, color: C.ink.amber, fontWeight: "600", fontSize: 14 }}>
            {data.noFace.length} need a face photo to scan: {data.noFace.slice(0, 3).map((e) => e.name).join(", ")}{data.noFace.length > 3 ? "…" : ""}
          </Text>
          <ChevronRight size={18} color={C.ink.amber} />
        </PressScale>
      ) : null}
    </>
  );
}

export default function Today() {
  useExitOnBack();
  const insets = useSafeAreaInsets();
  const layout = useWindowLayout();
  const { me } = useAuth();
  const { data, error, refreshing, reload } = useLoad(
    () => api.get<Dashboard>("/api/m/dashboard").then((d) => { rememberNames(d.rows); return d; }),
    [],
    ["attendance", "employee", "approval", "salary", "advance"],
  );
  // Frosted status bar: appears once the page scrolls under it (at rest the hero reaches the top).
  const blurTarget = useRef<ComponentRef<typeof View>>(null);
  const [scrolled, setScrolled] = useState(false);
  const onScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const s = e.nativeEvent.contentOffset.y > 8;
    if (s !== scrolled) setScrolled(s);
  };
  if (!data && error) return <View style={{ flex: 1, paddingTop: insets.top }}><ErrorView message={error} onRetry={reload} /></View>;
  if (!data) return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: C.bg }}><Loading /></View>;
  const rate = data.counts.total ? data.counts.present / data.counts.total : 0;
  const hours = data.storeHours ? `Open ${data.storeHours.open} – ${data.storeHours.close}${data.storeHours.anyScanFullDay ? " · any scan = full day" : ""}` : "Weekly off today";

  // ── Open foldable / tablet: dual-panel dashboard on the brand gradient (reference: image 5).
  if (layout.twoPane) {
    return (
      <View style={{ flex: 1 }}>
        <GradientFill />
        <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
        <ScrollView onScroll={onScroll} scrollEventThrottle={32} refreshControl={<RefreshControl {...refreshProps(refreshing, reload)} />} contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24, paddingHorizontal: 20, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{(me?.user.name ?? "?").slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 24, fontWeight: "600", letterSpacing: -0.5 }} numberOfLines={1}>{data.greeting}</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }} numberOfLines={1}>{me?.business.name} · {hours}</Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 15 }}>{dateLabel(data.date)}</Text>
            <LiveDot light />
          </View>
          <View style={{ flexDirection: layout.width - RAIL_WIDTH >= 560 ? "row" : "column", gap: 16, alignItems: "flex-start" }}>
            {/* Left panel: attendance now + who is in */}
            <View style={{ flex: layout.foldLike ? 1 : 1.25, gap: 16, alignSelf: "stretch" }}>
              <Card style={{ borderRadius: 28, padding: 20, gap: 8, ...shadow(2) }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>Present today</Text>
                    <Text style={{ fontSize: 13, color: C.muted }}>{data.counts.total} staff · updated live</Text>
                  </View>
                  <Users size={22} color={C.muted} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 6 }}>
                  <CountUp value={data.counts.present} style={{ fontSize: 64, fontWeight: "700", color: C.text, letterSpacing: -2, lineHeight: 70 }} />
                  <Text style={{ fontSize: 26, color: C.faint, fontWeight: "600", marginBottom: 10 }}>/ {data.counts.total}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Badge label={`${data.counts.inside} inside now`} tone="green" dot />
                  <Badge label={`${data.counts.notIn} not in yet`} tone={data.counts.notIn ? "amber" : "neutral"} />
                </View>
                <Text style={{ fontSize: 13, color: C.muted, marginTop: 10 }}>Arrivals through the day</Text>
                <ArrivalsChart arrivals={data.arrivals} height={130} />
              </Card>
              <PeopleCard data={data} />
            </View>
            {/* Right panel: rate gauge, money, sites, alerts */}
            <View style={{ flex: 1, gap: 16, alignSelf: "stretch" }}>
              <Card style={{ borderRadius: 28, alignItems: "center", ...shadow(2) }}>
                <View style={{ alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>Attendance rate</Text>
                    <Text style={{ fontSize: 13, color: C.muted }}>{dateLabel(data.date)}</Text>
                  </View>
                  <Clock size={20} color={C.muted} />
                </View>
                <DotGauge value={rate} size={Math.min(220, Math.round((layout.width - RAIL_WIDTH) / 2) - 64)} label={`${Math.round(rate * 100)}%`} sub={`${data.counts.present} present · ${data.counts.notIn} to come`} />
              </Card>
              {data.payroll ? <PayrollCard p={data.payroll} /> : null}
              <Alerts data={data} />
              <SitesCard data={data} />
            </View>
          </View>
        </ScrollView>
        </BlurTargetView>
        <BlurStrip height={insets.top} target={blurTarget} visible={scrolled} />
      </View>
    );
  }

  // ── Phone: gradient hero with the numbers, then money, sites and people.
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
    <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} onScroll={onScroll} scrollEventThrottle={32} refreshControl={<RefreshControl {...refreshProps(refreshing, reload)} progressViewOffset={insets.top} />} contentContainerStyle={{ paddingBottom: FLOATING_NAV_SPACE + insets.bottom + 16 }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 22, gap: 16, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden" }}>
        <GradientFill />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "500" }} numberOfLines={1}><Building size={13} color="rgba(255,255,255,0.8)" /> {me?.business.name}</Text>
            <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700", letterSpacing: -0.6 }} numberOfLines={1}>{data.greeting}</Text>
          </View>
          <LiveDot light />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>{dateLabel(data.date)} · {hours}</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <CountUp value={data.counts.present} style={{ color: "#fff", fontSize: 52, fontWeight: "700", letterSpacing: -1.5, lineHeight: 58 }} />
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 20, fontWeight: "600", marginBottom: 8 }}>/ {data.counts.total} present</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.22)", overflow: "hidden" }}>
            <View style={{ width: `${Math.round(rate * 100)}%`, height: 8, borderRadius: 4, backgroundColor: "#4ade80" }} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <HeroStat label="Inside now" value={data.counts.inside} />
          <HeroStat label="Not in yet" value={data.counts.notIn} />
          <HeroStat label="Approvals" value={data.counts.pendingApprovals} alert={!!data.counts.pendingApprovals} onPress={() => router.push("/approvals")} />
        </View>
      </View>
      <View style={{ padding: 16, gap: 14 }}>
        <Alerts data={data} />
        {data.payroll ? <PayrollCard p={data.payroll} /> : null}
        {data.rows.some((r) => r.inAt) ? (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>Arrivals</Text>
              <InkText ink="blue" style={{ fontSize: 13 }}>{data.rows.filter((r) => r.inAt).length} checked in</InkText>
            </View>
            <ArrivalsChart arrivals={data.arrivals} height={90} />
          </Card>
        ) : null}
        <SitesCard data={data} />
        <SectionLabel>People</SectionLabel>
        <PeopleCard data={data} />
      </View>
    </ScrollView>
    </BlurTargetView>
    <BlurStrip height={insets.top} target={blurTarget} visible={scrolled} />
    </View>
  );
}
