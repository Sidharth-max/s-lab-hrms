import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { CalendarCheck, Camera, ChevronRight, HandCoins, Pencil } from "lucide-react-native";
import { Avatar, Badge, Button, Card, ErrorView, Field, H2, Loading, Muted, Notice, Row, Screen, Segmented } from "@/components/ui";
import { DateField, MonthField } from "@/components/pickers";
import { MonthGrid } from "@/components/MonthGrid";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateLabel, monthLabel, rs } from "@/lib/format";
import { C, statusTone } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { useDialog } from "@/components/dialog";

interface Detail {
  employee: {
    id: string; name: string; code: string; phone: string | null; siteId: string; site: string; joinedOn: string; leftOn: string | null; active: boolean;
    wageType: "MONTHLY" | "DAILY"; wage: number; basicPercent: number; pfEnabled: boolean; esiEnabled: boolean; uanNumber: string | null; esicNumber: string | null; customWeeklyOff: boolean; weeklyOffDays: number[];
    face: boolean; faceEnrolledAt: string | null; webLogin: boolean;
  };
  balance: { earned: number; outstanding: number; balance: number };
  today: { status: string; label: string } | null;
  pendingAdvances: number;
  advances: { id: string; givenOn: string; amount: number; recovered: number; remaining: number; recoveryMonths: number; startMonth: string; note: string | null }[];
  salary: { id: string; month: string; locked: boolean; payableDays: number; gross: number; net: number; paid: number }[];
}

interface Register {
  month: string;
  current: string;
  rows: { days: { date: string; status: string; short: string; manual: boolean; missingOut: boolean }[]; present: number; absent: number; leave: number }[];
}

type Tab = "overview" | "attendance" | "advance" | "salary" | "account";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function istToday() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

/** One person's month as a calendar. Tap a day to see or fix it. */
function MonthCalendar({ employeeId }: { employeeId: string }) {
  const [month, setMonth] = useState<string | null>(null);
  const { data, error, reload } = useLoad(
    () => api.get<Register>(`/api/m/register?employeeId=${employeeId}${month ? `&month=${month}` : ""}`),
    [employeeId, month],
    ["attendance", "employee", "settings"],
  );
  if (!data && error) return <Notice tone="red" text={error} />;
  if (!data) return <Loading />;
  const row = data.rows[0];
  return (
    <Card>
      <MonthField value={data.month} onChange={setMonth} max={data.current} />
      {!row ? <Muted>Not employed in this month.</Muted> : (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Badge label={`Present ${row.present}`} tone="green" />
            <Badge label={`Absent ${row.absent}`} tone="red" />
            <Badge label={`Leave ${row.leave}`} />
          </View>
          <MonthGrid employeeId={employeeId} month={data.month} days={row.days} />
          <Muted>P present · H half · A absent · PL/UL leave · WO off · HO holiday · * edited · ! no out punch</Muted>
        </>
      )}
      {error ? <Button title="Retry" variant="secondary" onPress={reload} /> : null}
    </Card>
  );
}

function GiveAdvance({ employeeId, onDone }: { employeeId: string; onDone: (m: { text: string; ok: boolean }) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("1");
  const [givenOn, setGivenOn] = useState(istToday());
  const [startMonth, setStartMonth] = useState(istToday().slice(0, 7));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <H2>Give advance</H2>
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <DateField label="Given on" value={givenOn} onChange={setGivenOn} max={istToday()} />
      <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Recover over</Text>
      <Segmented options={[{ value: "1", label: "Full" }, { value: "2", label: "2 m" }, { value: "3", label: "3 m" }, { value: "6", label: "6 m" }, { value: "12", label: "12 m" }]} value={months} onChange={setMonths} />
      <MonthField label="First recovery month" value={startMonth} onChange={setStartMonth} />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
      <Button
        title="Save advance"
        icon={<HandCoins size={18} color={C.white} />}
        loading={busy}
        disabled={!amount}
        onPress={async () => {
          setBusy(true);
          try {
            const r = await api.action("giveAdvance", { employeeId, amount, recoveryMonths: months, givenOn, startMonth, note });
            setAmount("");
            setNote("");
            await onDone({ text: r.message ?? "Saved", ok: true });
          } catch (e) {
            await onDone({ text: (e as Error).message, ok: false });
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

export default function EmployeeDetail() {
  const dialog = useDialog();
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { me, can } = useAuth();
  const { data, error, refreshing, reload } = useLoad(() => api.get<Detail>(`/api/m/employees/${id}`), [id], ["employee", "advance", "approval", "payroll", "attendance"]);
  const [tab, setTab] = useState<Tab>("overview"); // a new employee lands on Overview, where the face photo button is first
  const [leftOn, setLeftOn] = useState(istToday());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function run(name: string, body: Record<string, unknown>) {
    setBusy(name);
    setMsg(null);
    try {
      const r = await api.action(name, body);
      setMsg({ text: r.message ?? "Saved", ok: true });
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
  const isOwner = me?.user.role === "OWNER";
  const weeklyOff = e.customWeeklyOff ? (e.weeklyOffDays.length ? e.weeklyOffDays.map((d) => DAYS[d]).join(", ") : "None") : "Same as business";

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Stack.Screen
        options={{
          title: e.name,
          headerRight: manage
            ? () => (
                <Pressable onPress={() => router.push({ pathname: "/employee/edit/[id]", params: { id: e.id } })} hitSlop={10} accessibilityLabel="Edit employee" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 }}>
                  <Pencil size={18} color={C.headText} strokeWidth={1.75} />
                  <Text style={{ color: C.headText, fontWeight: "600" }}>Edit</Text>
                </Pressable>
              )
            : undefined,
        }}
      />

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar name={e.name} size={52} muted={!e.active} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 19, fontWeight: "700", color: C.text, letterSpacing: -0.3 }}>{e.name}</Text>
            <Muted>{e.code} · {e.site}{e.phone ? ` · ${e.phone}` : ""}</Muted>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {e.active ? <Badge label="Active" tone="neutral" /> : <Badge label={`Archived${e.leftOn ? ` · ${dateLabel(e.leftOn)}` : ""}`} />}
              {data.today ? (
                <Badge
                  label={`Today: ${data.today.label}`}
                  tone={statusTone(data.today.status)}
                  dot
                />
              ) : null}
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Badge label={e.face ? "Face enrolled" : "No face"} tone={e.face ? "green" : "red"} dot />
          <Badge label={`${rs(e.wage)} ${e.wageType === "MONTHLY" ? "/ month" : "/ day"}`} />
          {e.pfEnabled ? <Badge label="PF" /> : null}
          {e.esiEnabled ? <Badge label="ESIC" /> : null}
        </View>
        <Row label="Balance this month" value={<Text style={{ fontSize: 15, fontWeight: "700", color: data.balance.balance < 0 ? C.red : C.text }}>{rs(data.balance.balance)}</Text>} />
      </Card>

      {created ? <Notice tone="green" text="Employee added. Now take the face photos." /> : null}
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}

      <Segmented
        options={[
          { value: "overview", label: "Info" },
          { value: "attendance", label: "Attendance" },
          { value: "advance", label: "Advance" },
          { value: "salary", label: "Salary" },
          ...(manage ? [{ value: "account" as Tab, label: "Access" }] : []),
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "overview" ? (
        <>
          <Card>
            <H2>Face for attendance</H2>
            <Muted>{e.face ? `Enrolled ${e.faceEnrolledAt ? dateLabel(e.faceEnrolledAt.slice(0, 10)) : ""}` : "Not enrolled. This person cannot use the scanner yet."}</Muted>
            {manage && e.active ? (
              <Button title={e.face ? "Re-take face photos" : "Take face photos"} icon={<Camera size={18} color={C.white} />} onPress={() => router.push({ pathname: "/face-enroll", params: { id: e.id, name: e.name } })} />
            ) : null}
            {manage && e.face ? (
              <Button
                title="Remove face"
                variant="secondary"
                loading={busy === "removeFace"}
                onPress={async () => { if (await dialog.confirm({ title: "Remove face?", message: "The employee will not be able to scan.", confirmText: "Remove", danger: true })) void run("removeFace", { id: e.id }); }}
              />
            ) : null}
          </Card>
          <Card>
            <Button title="Attendance today" variant="secondary" icon={<CalendarCheck size={18} color={C.text} />} onPress={() => router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId: e.id, date: istToday() } })} />
            {can("advances.manage") && e.active ? <Button title="Give advance" variant="secondary" icon={<HandCoins size={18} color={C.text} />} onPress={() => setTab("advance")} /> : null}
          </Card>
          <Card>
            <H2>Details</H2>
            <Row label="Mobile" value={e.phone ?? "—"} />
            <Row label="Joined" value={dateLabel(e.joinedOn)} />
            <Row label="Pay" value={`${rs(e.wage)} ${e.wageType === "MONTHLY" ? "per month" : "per day"}`} />
            <Row label="Basic for PF" value={`${e.basicPercent}%`} />
            <Row label="PF" value={e.pfEnabled ? (e.uanNumber ? `UAN ${e.uanNumber}` : "On · UAN not added") : "Off"} />
            <Row label="ESIC" value={e.esiEnabled ? (e.esicNumber ? `IP ${e.esicNumber}` : "On · IP number not added") : "Off"} />
            <Row label="Weekly off" value={weeklyOff} />
            {manage ? <Button title="Edit details" variant="secondary" icon={<Pencil size={16} color={C.text} />} onPress={() => router.push({ pathname: "/employee/edit/[id]", params: { id: e.id } })} /> : null}
          </Card>
        </>
      ) : null}

      {tab === "attendance" ? <MonthCalendar employeeId={e.id} /> : null}

      {tab === "advance" ? (
        <>
          <Card>
            <H2>Advance balance</H2>
            <Row label="Earned this month" value={rs(data.balance.earned)} />
            <Row label="Advance to recover" value={rs(data.balance.outstanding)} />
            <Row label="Balance" value={<Text style={{ fontSize: 15, fontWeight: "700", color: data.balance.balance < 0 ? C.red : C.text }}>{rs(data.balance.balance)}</Text>} />
            {data.pendingAdvances ? <Notice text={`${data.pendingAdvances} advance(s) waiting for owner approval.`} /> : null}
          </Card>
          {data.advances.length ? (
            <Card style={{ padding: 0, gap: 0 }}>
              {data.advances.map((a, i) => (
                <Pressable key={a.id} onPress={() => router.push({ pathname: "/advance/[id]", params: { id: a.id } })} style={({ pressed }) => [{ padding: 14, gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }, pressed && { backgroundColor: C.soft }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontWeight: "600", color: C.text }}>{dateLabel(a.givenOn)} · {rs(a.amount)}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ fontWeight: "700", color: C.text }}>{rs(a.remaining)} left</Text>
                      <ChevronRight size={16} color={C.muted} />
                    </View>
                  </View>
                  <Muted>Recovered {rs(a.recovered)} · {a.recoveryMonths === 1 ? "Full" : `${a.recoveryMonths} months`} from {monthLabel(a.startMonth)}{isOwner ? " · tap to edit" : ""}</Muted>
                </Pressable>
              ))}
            </Card>
          ) : null}
          {can("advances.manage") && e.active ? <GiveAdvance employeeId={e.id} onDone={async (m) => { setMsg(m); await reload(); }} /> : null}
        </>
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
              <Muted>{s.payableDays} days · gross {rs(s.gross)} · paid {s.paid ? rs(s.paid) : "—"}{s.locked ? "" : " · draft"} · payslip</Muted>
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
            <H2>{e.active ? "Archive employee" : "Archived"}</H2>
            <Muted>{e.active ? "When someone stops working here, archive them. Their face is deleted so they cannot scan; attendance, salary and advance history stay." : `Archived${e.leftOn ? ` on ${dateLabel(e.leftOn)}` : ""}. Restore to make them active again, then take the face photos again.`}</Muted>
            {e.active ? <DateField label="Last working day" value={leftOn} onChange={setLeftOn} min={e.joinedOn} /> : null}
            <Button
              title={e.active ? "Archive employee" : "Restore employee"}
              variant={e.active ? "danger" : "primary"}
              loading={busy === "setEmployeeLeft"}
              onPress={async () => {
                if (!e.active) return void run("setEmployeeLeft", { id: e.id, leftOn: "" });
                if (await dialog.confirm({ title: "Archive this employee?", message: `Last working day ${dateLabel(leftOn)}. Their face will be deleted. Attendance and salary history are kept.`, confirmText: "Archive", danger: true })) void run("setEmployeeLeft", { id: e.id, leftOn });
              }}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
