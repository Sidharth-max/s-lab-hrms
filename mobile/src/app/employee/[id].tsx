import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, Text, View } from "react-native";
import { Camera, CalendarDays } from "lucide-react-native";
import { Badge, Button, Card, ErrorView, Field, H2, Loading, Muted, Notice, Row, Screen, Segmented } from "@/components/ui";
import { EmployeeForm, employeeBody } from "@/components/EmployeeForm";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateLabel, monthLabel, rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Detail {
  employee: {
    id: string; name: string; code: string; phone: string | null; siteId: string; site: string; joinedOn: string; leftOn: string | null; active: boolean;
    wageType: "MONTHLY" | "DAILY"; wage: number; basicPercent: number; pfEnabled: boolean; esiEnabled: boolean; customWeeklyOff: boolean; weeklyOffDays: number[];
    face: boolean; faceEnrolledAt: string | null; webLogin: boolean;
  };
  balance: { earned: number; outstanding: number; balance: number };
  pendingAdvances: number;
  advances: { id: string; givenOn: string; amount: number; recovered: number; remaining: number; recoveryMonths: number; startMonth: string }[];
  salary: { id: string; month: string; locked: boolean; payableDays: number; gross: number; net: number; paid: number }[];
}

type Tab = "face" | "advance" | "details" | "salary" | "account";

function istToday() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

export default function EmployeeDetail() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { me, can } = useAuth();
  const { data, error, refreshing, reload } = useLoad(() => api.get<Detail>(`/api/m/employees/${id}`), [id], ["employee", "advance", "approval", "payroll", "attendance"]);
  const [tab, setTab] = useState<Tab>(created ? "face" : "face");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("1");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function run(name: string, body: Record<string, unknown>, after?: () => void) {
    setBusy(name);
    setMsg(null);
    try {
      const r = await api.action(name, body);
      setMsg({ text: r.message ?? "Saved", ok: true });
      after?.();
      await reload();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy(null);
    }
  }

  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const e = data.employee;
  const manage = can("employees.manage");

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Stack.Screen options={{ title: e.name }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Muted>{e.code} · {e.site}</Muted>
        {!e.active ? <Badge label={`Left ${e.leftOn ? dateLabel(e.leftOn) : ""}`} /> : null}
      </View>
      {created ? <Notice tone="green" text="Employee added. Now take the face photo." /> : null}
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}
      <Segmented
        options={[
          { value: "face", label: "Face" },
          { value: "advance", label: "Advance" },
          { value: "details", label: "Details" },
          { value: "salary", label: "Salary" },
          ...(manage ? [{ value: "account" as Tab, label: "Login" }] : []),
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "face" ? (
        <Card>
          <H2>Face for attendance</H2>
          <Muted>{e.face ? `Enrolled ${e.faceEnrolledAt ? dateLabel(e.faceEnrolledAt.slice(0, 10)) : ""}` : "Not enrolled. This person cannot use the scanner yet."}</Muted>
          {manage && e.active ? (
            <Button title={e.face ? "Re-take face photo" : "Take face photo"} icon={<Camera size={18} color={C.white} />} onPress={() => router.push({ pathname: "/face-enroll", params: { id: e.id, name: e.name } })} />
          ) : null}
          {manage && e.face ? (
            <Button
              title="Remove face"
              variant="secondary"
              loading={busy === "removeFace"}
              onPress={() => Alert.alert("Remove face?", "The employee will not be able to scan.", [{ text: "Cancel" }, { text: "Remove", style: "destructive", onPress: () => run("removeFace", { id: e.id }) }])}
            />
          ) : null}
          <Button title="Attendance today" variant="secondary" icon={<CalendarDays size={18} color={C.text} />} onPress={() => router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId: e.id, date: istToday() } })} />
        </Card>
      ) : null}

      {tab === "advance" ? (
        <Card>
          <H2>Advance balance</H2>
          <Row label="Earned this month" value={rs(data.balance.earned)} />
          <Row label="Advance to recover" value={rs(data.balance.outstanding)} />
          <Row label="Balance" value={<Text style={{ fontSize: 15, fontWeight: "700", color: data.balance.balance < 0 ? C.red : C.text }}>{rs(data.balance.balance)}</Text>} />
          {data.advances.map((a) => (
            <View key={a.id} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
              <Row label={dateLabel(a.givenOn)} value={rs(a.amount)} />
              <Muted>Recovered {rs(a.recovered)} · {a.recoveryMonths === 1 ? "Full" : `${a.recoveryMonths} months`} from {monthLabel(a.startMonth)}</Muted>
            </View>
          ))}
          {data.pendingAdvances ? <Notice text={`${data.pendingAdvances} advance(s) waiting for owner approval.`} /> : null}
          {can("advances.manage") && e.active ? (
            <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 }}>
              <H2>Give advance</H2>
              <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
              <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Recover over</Text>
              <Segmented options={[{ value: "1", label: "Full" }, { value: "2", label: "2 m" }, { value: "4", label: "4 m" }, { value: "6", label: "6 m" }, { value: "12", label: "12 m" }]} value={months} onChange={setMonths} />
              <Button title="Save advance" loading={busy === "giveAdvance"} disabled={!amount} onPress={() => run("giveAdvance", { employeeId: e.id, amount, recoveryMonths: months }, () => setAmount(""))} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {tab === "details" ? (
        manage ? (
          <Card>
            <EmployeeForm
              isNew={false}
              canSalary={can("salary.edit")}
              sites={me?.sites ?? []}
              submitTitle="Save"
              initial={{
                name: e.name, code: e.code, phone: e.phone ?? "", siteId: e.siteId, joinedOn: e.joinedOn, wageType: e.wageType,
                wage: String(e.wage / 100), basicPercent: String(e.basicPercent), pfEnabled: e.pfEnabled, esiEnabled: e.esiEnabled,
                customWeeklyOff: e.customWeeklyOff, weeklyOffDays: e.weeklyOffDays,
              }}
              onSubmit={async (v) => {
                try {
                  const r = await api.action("updateEmployee", { id: e.id, ...employeeBody(v, can("salary.edit"), false) });
                  setMsg({ text: r.message ?? "Saved", ok: true });
                  await reload();
                  return null;
                } catch (err) {
                  return (err as Error).message;
                }
              }}
            />
          </Card>
        ) : (
          <Card>
            <Row label="Mobile" value={e.phone ?? "—"} />
            <Row label="Pay" value={`${rs(e.wage)} ${e.wageType === "MONTHLY" ? "/ month" : "/ day"}`} />
            <Row label="PF / ESIC" value={`${e.pfEnabled ? "PF" : "—"} ${e.esiEnabled ? "ESIC" : ""}`} />
            <Row label="Joined" value={dateLabel(e.joinedOn)} />
          </Card>
        )
      ) : null}

      {tab === "salary" ? (
        <Card style={{ gap: 0 }}>
          {data.salary.length === 0 ? <Muted>No salary prepared yet.</Muted> : null}
          {data.salary.map((s, i) => (
            <Pressable key={s.id} onPress={() => router.push({ pathname: "/payslip/[lineId]", params: { lineId: s.id } })} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, gap: 2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "600", color: C.text }}>{monthLabel(s.month)}</Text>
                <Text style={{ fontWeight: "700", color: C.text }}>{rs(s.net)}</Text>
              </View>
              <Muted>{s.payableDays} days · gross {rs(s.gross)} · paid {s.paid ? rs(s.paid) : "—"}{s.locked ? "" : " · draft"}</Muted>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {tab === "account" && manage ? (
        <>
          <Card>
            <H2>Web login (view only)</H2>
            <Muted>{e.webLogin ? `On. ${e.name} can see salary and attendance on the website with ${e.phone}.` : "Off. Turn on so the employee can view their own salary on the website."}</Muted>
            <Button title={e.webLogin ? "Turn off web login" : "Turn on web login"} variant="secondary" loading={busy === "setEmployeeLogin"} onPress={() => run("setEmployeeLogin", { id: e.id, enable: e.webLogin ? "0" : "1" })} />
          </Card>
          <Card>
            <H2>{e.active ? "Employee left" : "Rejoin"}</H2>
            <Button
              title={e.active ? "Mark as left today" : "Make active again"}
              variant={e.active ? "danger" : "secondary"}
              loading={busy === "setEmployeeLeft"}
              onPress={() =>
                e.active
                  ? Alert.alert("Mark as left?", "Their face will be deleted. Attendance and salary history are kept.", [
                      { text: "Cancel" },
                      { text: "Mark as left", style: "destructive", onPress: () => run("setEmployeeLeft", { id: e.id, leftOn: istToday() }) },
                    ])
                  : run("setEmployeeLeft", { id: e.id, leftOn: "" })
              }
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
