import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { ArrowDownLeft, ArrowUpRight, Cash } from "@/components/icons";
import { Avatar, Badge, Card, ErrorView, Loading, Muted, refreshProps, Tabs } from "@/components/ui";
import { PaySheet } from "@/components/HisaabSection";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateLabel, rs } from "@/lib/format";
import { C, shadow } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { FLOATING_NAV_SPACE } from "@/lib/layout";
import { rememberNames } from "@/lib/names";
import { Animated, CountUp, enterAt, PressScale } from "@/lib/motion";

// Same data model as the website's Salary page (server: src/lib/salary-view.ts).
interface Row { employeeId: string; name: string; code: string; active: boolean; wageType: "MONTHLY" | "DAILY"; wage: number; earned: number; advances: number; payments: number; balance: number; lastPaidOn: string | null; pendingAdvances: number }
interface View_ { rows: Row[]; toPay: number; owed: number; due: number; paidThisMonth: number; advancesThisMonth: number }

/**
 * Salary: who needs to be paid, and how much. Kept as its own tab (not merged into Employees)
 * because it answers a different, monthly question: the total the business owes right now and
 * who is due. Each row can be paid straight from here (bottom sheet); tapping the person opens
 * their full ledger.
 */
export default function SalaryScreen() {
  const { can } = useAuth();
  const [show, setShow] = useState<"due" | "active" | "all" | "archived">("due");
  const [paying, setPaying] = useState<Row | null>(null);
  const { data, error, refreshing, reload } = useLoad(
    () => api.get<View_>(`/api/m/salary?show=${show === "due" ? "active" : show}`).then((d) => { rememberNames(d.rows); return d; }),
    [show],
    ["salary", "advance", "approval", "attendance", "employee"],
  );
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const rows = show === "due" ? data.rows.filter((r) => r.balance !== 0) : data.rows;
  const canPay = can("payroll.lock");

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.employeeId}
        refreshControl={<RefreshControl {...refreshProps(refreshing, reload)} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 + FLOATING_NAV_SPACE }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 2 }}>
            <Card style={{ gap: 4, ...shadow(2) }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: C.muted }}>Total to pay now</Text>
              <CountUp value={data.toPay} format={(n) => rs(Math.round(n / 100) * 100)} style={{ fontSize: 34, fontWeight: "700", color: C.ink.green, letterSpacing: -1 }} />
              <Text style={{ fontSize: 13, color: C.muted }}>{data.due} {data.due === 1 ? "person is" : "people are"} due{data.owed > 0 ? <Text> · <Text style={{ color: C.ink.red, fontWeight: "600" }}>{rs(data.owed)}</Text> owed by staff</Text> : null}</Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1, backgroundColor: C.tint.blue, borderRadius: 16, padding: 12, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><ArrowUpRight size={15} color={C.ink.blue} /><Text style={{ fontSize: 12, fontWeight: "600", color: C.ink.blue }}>Salary paid · this month</Text></View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: C.ink.blue, fontVariant: ["tabular-nums"] }}>{rs(data.paidThisMonth)}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: C.tint.orange, borderRadius: 16, padding: 12, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><ArrowDownLeft size={15} color={C.ink.orange} /><Text style={{ fontSize: 12, fontWeight: "600", color: C.ink.orange }}>Advances · this month</Text></View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: C.ink.orange, fontVariant: ["tabular-nums"] }}>{rs(data.advancesThisMonth)}</Text>
                </View>
              </View>
            </Card>
            <Tabs
              options={[{ value: "due", label: `Due · ${data.rows.filter((r) => r.balance !== 0).length}` }, { value: "active", label: "Active" }, { value: "all", label: "All" }, { value: "archived", label: "Archived" }]}
              value={show}
              onChange={setShow}
            />
            <Muted style={{ fontSize: 13 }}>
              <Text style={{ color: C.ink.violet, fontWeight: "600" }}>Earned</Text> minus <Text style={{ color: C.ink.orange, fontWeight: "600" }}>advances</Text> and <Text style={{ color: C.ink.blue, fontWeight: "600" }}>salary paid</Text> = <Text style={{ color: C.ink.green, fontWeight: "600" }}>to pay</Text>.
            </Muted>
          </View>
        }
        ListEmptyComponent={
          <Card style={{ alignItems: "center", paddingVertical: 28 }}>
            <Badge label="All clear" tone="green" dot />
            <Muted style={{ textAlign: "center" }}>{show === "due" ? "Nobody is waiting for salary right now." : "No employees."}</Muted>
          </Card>
        }
        renderItem={({ item: r, index }) => (
          <Animated.View entering={enterAt(index)}>
            <Pressable
              onPress={() => router.push({ pathname: "/employee/[id]", params: { id: r.employeeId, name: r.name, tab: "ledger" } })}
              style={({ pressed }) => [{ backgroundColor: pressed ? C.soft : C.card, borderWidth: 1, borderColor: C.hairline, borderRadius: 20, padding: 14, gap: 12 }, shadow(1)]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Avatar name={r.name} size={42} muted={!r.active} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }} numberOfLines={1}>{r.name} <Text style={{ color: C.muted, fontWeight: "400" }}>{r.code}</Text></Text>
                  <Muted style={{ fontSize: 13 }}>{r.lastPaidOn ? `Last paid ${dateLabel(r.lastPaidOn)}` : "Never paid"}{r.active ? "" : " · archived"}</Muted>
                </View>
                {r.balance === 0 ? (
                  <Badge label="Clear" tone="green" />
                ) : (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: r.balance < 0 ? C.ink.red : C.ink.green, fontVariant: ["tabular-nums"] }}>{rs(Math.abs(r.balance))}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: r.balance < 0 ? C.ink.red : C.ink.green }}>{r.balance < 0 ? "owes you" : "to pay"}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: C.muted }}>Earned</Text><Text style={{ fontSize: 14, fontWeight: "600", color: C.ink.violet, fontVariant: ["tabular-nums"] }}>{rs(r.earned)}</Text></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: C.muted }}>Advances</Text><Text style={{ fontSize: 14, fontWeight: "600", color: C.ink.orange, fontVariant: ["tabular-nums"] }}>{rs(r.advances)}</Text></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: C.muted }}>Paid</Text><Text style={{ fontSize: 14, fontWeight: "600", color: C.ink.blue, fontVariant: ["tabular-nums"] }}>{rs(r.payments)}</Text></View>
                {canPay && r.balance > 0 && r.active ? (
                  <PressScale onPress={() => setPaying(r)} accessibilityRole="button" accessibilityLabel={`Pay ${rs(r.balance)} to ${r.name}`} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.head, borderRadius: 999, paddingHorizontal: 14, height: 38, alignSelf: "center" }}>
                    <Cash size={17} color={C.headText} />
                    <Text style={{ color: C.headText, fontWeight: "600", fontSize: 14 }}>Pay</Text>
                  </PressScale>
                ) : null}
              </View>
            </Pressable>
          </Animated.View>
        )}
      />
      {paying ? (
        <PaySheet
          visible
          employeeId={paying.employeeId}
          name={paying.name}
          balance={paying.balance}
          onClose={() => setPaying(null)}
          onDone={async () => { setPaying(null); await reload(); }}
        />
      ) : null}
    </>
  );
}
