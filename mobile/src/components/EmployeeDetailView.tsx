import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { Beach, CalendarCheck, CalendarDays, Camera, HandCoins, LogIn, Pencil, RotateCcw, ScanFace, Trash2, UserCog } from "@/components/icons";
import { Badge, Button, Card, ErrorView, Hero, Loading, Muted, Notice, refreshProps, Row, Screen, SectionHead, Tabs } from "@/components/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DateField, MonthField } from "@/components/pickers";
import { MonthGrid } from "@/components/MonthGrid";
import { HisaabSection, LedgerActions, LedgerSheets, type Hisaab, type HisaabCan, type LedgerForm } from "@/components/HisaabSection";
import { LeaveSection } from "@/components/LeaveSection";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateLabel, rs } from "@/lib/format";
import { C, shadow, statusTone } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { useDialog } from "@/components/dialog";

interface Detail {
  employee: {
    id: string; name: string; code: string; phone: string | null; siteId: string; site: string; joinedOn: string; leftOn: string | null; active: boolean;
    wageType: "MONTHLY" | "DAILY"; wage: number; basicPercent: number; pfEnabled: boolean; esiEnabled: boolean; uanNumber: string | null; esicNumber: string | null; customWeeklyOff: boolean; weeklyOffDays: number[];
    face: boolean; faceEnrolledAt: string | null; webLogin: boolean; inHouse: boolean;
  };
  today: { status: string; label: string } | null;
  hisaab: Hisaab;
  wages: { from: string; wageType: "MONTHLY" | "DAILY"; wage: number }[];
  can: HisaabCan;
}

interface Register {
  month: string;
  current: string;
  rows: { days: { date: string; status: string; short: string; manual: boolean; missingOut: boolean }[]; present: number; absent: number; leave: number }[];
}

type Tab = "overview" | "attendance" | "ledger" | "account";
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
      <SectionHead icon={<CalendarDays size={18} color={C.ink.teal} />} ink="teal" title="Attendance" />
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

/**
 * One employee. Used as its own screen, and (embedded) as the right-hand panel next to the
 * employee list on wide screens such as an open foldable.
 */
export function EmployeeDetailView({ id, created, embedded, initialTab, onEdit }: { id: string; created?: string; embedded?: boolean; initialTab?: "ledger"; /** Panel version: edit inside the panel instead of opening the edit screen. */ onEdit?: () => void }) {
  const dialog = useDialog();
  const { can } = useAuth();
  const { data, error, refreshing, reload } = useLoad(() => api.get<Detail>(`/api/m/employees/${id}`), [id], ["employee", "advance", "approval", "salary", "attendance"]);
  const [tab, setTab] = useState<Tab>(initialTab ?? "overview"); // a new employee lands on Overview, where the face photo button is first
  const [leftOn, setLeftOn] = useState(istToday());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [form, setForm] = useState<LedgerForm>(null);
  const insets = useSafeAreaInsets();

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
  const weeklyOff = e.customWeeklyOff ? (e.weeklyOffDays.length ? e.weeklyOffDays.map((d) => DAYS[d]).join(", ") : "None") : "Same as business";

  const showActions = tab === "ledger" && (data.can.pay && data.hisaab.balance > 0 || data.can.advance && e.active || data.can.extras);
  return (
    <View style={{ flex: 1 }}>
    <Screen refreshControl={<RefreshControl {...refreshProps(refreshing, reload)} />} bottomSpace={showActions ? 90 : 0}>
      {embedded ? null : <Stack.Screen
        options={{
          title: e.name,
          headerRight: manage
            ? () => (
                <Pressable onPress={() => router.push({ pathname: "/employee/edit/[id]", params: { id: e.id } })} hitSlop={10} accessibilityLabel="Edit employee" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 }}>
                  <Pencil size={18} color={C.text} />
                  <Text style={{ color: C.text, fontWeight: "600" }}>Edit</Text>
                </Pressable>
              )
            : undefined,
        }}
      />}

      <Pressable onPress={() => setTab("ledger")} accessibilityLabel="Open ledger">
        <Hero
          right={embedded && manage && onEdit ? (
            <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit employee" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.2)" }}>
              <Pencil size={15} color="#ffffff" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Edit</Text>
            </Pressable>
          ) : undefined}
          avatar={e.name}
          eyebrow={`${e.code} · ${e.site}`}
          title={e.name}
          subtitle={e.phone ?? undefined}
          pills={[
            e.active ? { label: "Active", tone: "ok" as const } : { label: `Archived${e.leftOn ? ` · ${dateLabel(e.leftOn)}` : ""}` },
            ...(data.today ? [{ label: `Today: ${data.today.label}`, tone: statusTone(data.today.status) === "green" ? "ok" as const : statusTone(data.today.status) === "neutral" ? undefined : "alert" as const }] : []),
            ...(e.inHouse ? [{ label: "In-house" }] : []),
            ...(e.face ? [{ label: "Face enrolled", tone: "ok" as const }] : e.inHouse ? [] : [{ label: "No face", tone: "alert" as const }]),
            ...(e.pfEnabled ? [{ label: "PF" }] : []),
            ...(e.esiEnabled ? [{ label: "ESIC" }] : []),
          ]}
          valueLabel={data.hisaab.balance < 0 ? "Employee owes" : "Salary to pay"}
          value={data.hisaab.balance === 0 ? "Settled" : rs(Math.abs(data.hisaab.balance))}
          stats={[
            { label: e.wageType === "MONTHLY" ? "Per month" : "Per day", value: rs(e.wage) },
            { label: "Joined", value: dateLabel(e.joinedOn) },
          ]}
        />
      </Pressable>
      {!e.active && manage ? (
        <Button
          title="Restore employee"
          icon={<RotateCcw size={18} color="#ffffff" />}
          loading={busy === "setEmployeeLeft"}
          onPress={async () => {
            if (await dialog.confirm({ title: `Restore ${e.name}?`, message: "They become active again and appear in attendance. Take the face photos again so they can scan.", confirmText: "Restore" })) void run("setEmployeeLeft", { id: e.id, leftOn: "" });
          }}
        />
      ) : null}

      {created ? <Notice tone="green" text="Employee added. Now take the face photos." /> : null}
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}

      <Tabs
        options={[
          { value: "overview", label: "Info" },
          { value: "attendance", label: "Attendance" },
          { value: "ledger", label: "Ledger" },
          ...(manage ? [{ value: "account" as Tab, label: "Access" }] : []),
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "overview" ? (
        <>
          <Card>
            <SectionHead icon={<ScanFace size={18} color={C.ink.blue} />} ink="blue" title="Face for attendance" />
            <Muted>{e.face ? `Enrolled ${e.faceEnrolledAt ? dateLabel(e.faceEnrolledAt.slice(0, 10)) : ""}` : e.inHouse ? "Not needed: in-house staff are marked present automatically. Enrol a face only if they should also scan." : "Not enrolled. This person cannot use the scanner yet."}</Muted>
            {manage && e.active ? (
              <Button title={e.face ? "Re-take face photos" : "Take face photos"} icon={<Camera size={18} color="#ffffff" />} onPress={() => router.push({ pathname: "/face-enroll", params: { id: e.id, name: e.name } })} />
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
            <SectionHead icon={<CalendarCheck size={18} color={C.ink.teal} />} ink="teal" title="Quick actions" />
            <Button title="Attendance today" variant="secondary" icon={<CalendarCheck size={18} color={C.ink.teal} />} onPress={() => router.push({ pathname: "/attendance/[employeeId]/[date]", params: { employeeId: e.id, date: istToday(), name: e.name } })} />
            {can("advances.manage") && e.active ? <Button title={`Give advance to ${e.name.split(" ")[0]}`} variant="secondary" icon={<HandCoins size={18} color={C.ink.orange} />} onPress={() => setForm("advance")} /> : null}
          </Card>
          <Card>
            <SectionHead icon={<UserCog size={18} color={C.ink.violet} />} ink="violet" title="Details" />
            <Row label="Mobile" value={e.phone ?? "—"} />
            <Row label="Joined" value={dateLabel(e.joinedOn)} />
            <Row label="Pay" value={`${rs(e.wage)} ${e.wageType === "MONTHLY" ? "per month" : "per day"}`} />
            <Row label="Basic for PF" value={`${e.basicPercent}%`} />
            <Row label="PF" value={e.pfEnabled ? (e.uanNumber ? `UAN ${e.uanNumber}` : "On · UAN not added") : "Off"} />
            <Row label="ESIC" value={e.esiEnabled ? (e.esicNumber ? `IP ${e.esicNumber}` : "On · IP number not added") : "Off"} />
            <Row label="Attendance" value={e.inHouse ? "In-house (automatic)" : "Face scan"} />
            <Row label="Weekly off" value={weeklyOff} />
            {manage ? <Button title="Edit details" variant="secondary" icon={<Pencil size={16} color={C.text} />} onPress={() => (onEdit ? onEdit() : router.push({ pathname: "/employee/edit/[id]", params: { id: e.id } }))} /> : null}
          </Card>
        </>
      ) : null}

      {tab === "attendance" ? (
        <>
          <MonthCalendar employeeId={e.id} />
          <SectionHead icon={<Beach size={18} color={C.ink.teal} />} ink="teal" title="Leave" />
          <LeaveSection employeeId={e.id} active={e.active} />
        </>
      ) : null}

      {tab === "ledger" ? (
        <HisaabSection
          employee={{ id: e.id, name: e.name, active: e.active }}
          h={data.hisaab}
          wages={data.wages}
          can={data.can}
          onDone={async (m) => { setMsg(m); await reload(); }}
        />
      ) : null}

      {tab === "account" && manage ? (
        <>
          <Card>
            <SectionHead icon={<LogIn size={18} color={C.ink.blue} />} ink="blue" title="Web login (view only)" />
            <Muted>{e.webLogin ? `On. ${e.name} can see salary and attendance on the website with ${e.phone}.` : "Off. Turn on so the employee can view their own salary on the website."}</Muted>
            <Button title={e.webLogin ? "Turn off web login" : "Turn on web login"} variant="secondary" loading={busy === "setEmployeeLogin"} onPress={() => run("setEmployeeLogin", { id: e.id, enable: e.webLogin ? "0" : "1" })} />
          </Card>
          <Card>
            <SectionHead icon={<Trash2 size={18} color={C.ink.red} />} ink="red" title={e.active ? "Archive employee" : "Archived"} />
            <Muted>{e.active ? "When someone stops working here, archive them. Their face is deleted so they cannot scan; attendance, salary and advance history stay." : `Archived${e.leftOn ? ` on ${dateLabel(e.leftOn)}` : ""}. Restore to make them active again, then take the face photos again.`}</Muted>
            {e.active ? <DateField label="Last working day" value={leftOn} onChange={setLeftOn} min={e.joinedOn} /> : null}
            <Button
              title={e.active ? "Archive employee" : "Restore employee"}
              variant={e.active ? "danger" : "primary"}
              loading={busy === "setEmployeeLeft"}
              onPress={async () => {
                if (!e.active) return void run("setEmployeeLeft", { id: e.id, leftOn: "" });
                if (await dialog.confirm({ title: "Archive this employee?", message: `Last working day ${dateLabel(leftOn)}. Their face will be deleted and planned leave ends. Attendance and salary history are kept.${data.hisaab.balance > 0 ? ` Salary still to pay: ${rs(data.hisaab.balance)}.` : data.hisaab.balance < 0 ? ` They still owe ${rs(-data.hisaab.balance)}.` : ""}`, confirmText: "Archive", danger: true })) void run("setEmployeeLeft", { id: e.id, leftOn });
              }}
            />
          </Card>
        </>
      ) : null}
    </Screen>
    {showActions ? (
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.hairline, ...shadow(3) }}>
        <LedgerActions h={data.hisaab} can={data.can} active={e.active} name={e.name} onOpen={setForm} />
      </View>
    ) : null}
    <LedgerSheets employee={{ id: e.id, name: e.name }} h={data.hisaab} form={form} setForm={setForm} onDone={async (m) => { setMsg(m); await reload(); }} />
    </View>
  );
}
