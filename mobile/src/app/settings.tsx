import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "@/components/Text";
import { Beach, Building, ChevronDown, ChevronUp, Clock, Coins, Plus, Trash2, type IconType } from "@/components/icons";
import { Button, Card, ErrorView, Field, IconChip, Loading, Muted, Notice, refreshProps, Screen, Toggle } from "@/components/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { C, type Ink } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";
import { DateField, TimeField } from "@/components/pickers";
import { useDialog } from "@/components/dialog";
import { useUnsavedGuard } from "@/lib/unsaved";

/** Middle of the shift (same rule as the server): punched in after it or out before it = half day. */
function shiftMiddle(open: string, close: string) {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let span = m(close) - m(open);
  if (span <= 0) span += 1440;
  return fmt12((m(open) + Math.floor(span / 2)) % 1440);
}
function addMins(t: string, n: number) {
  return fmt12((Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + n) % 1440);
}
function fmt12(min: number) {
  const h = Math.floor(min / 60);
  return `${((h + 11) % 12) + 1}:${String(min % 60).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

interface DayRule { open: string; close: string; halfDayBelowMins: number; anyScanFullDay: boolean; graceMins?: number }
interface Settings {
  name: string; weeklyOffDays: number[]; dayRules: DayRule[]; duplicateScanMins: number; maxShiftHours: number;
  pfEmployeePct: number; pfEmployerPct: number; pfWageCeiling: number; esiEmployeePct: number; esiEmployerPct: number;
  sites: { id: string; name: string; active: boolean }[];
  holidays: { id: string; date: string; name: string }[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DayForm { off: boolean; open: string; close: string; grace: string; any: boolean }

export default function SettingsScreen() {
  const { data, error, refreshing, reload } = useLoad(() => api.get<Settings>("/api/m/settings"), [], ["settings"]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  // The form starts again from the server's values whenever they change.
  const key = JSON.stringify([data.name, data.weeklyOffDays, data.dayRules, data.duplicateScanMins, data.maxShiftHours, data.pfEmployeePct, data.esiEmployeePct]);
  return <SettingsForm key={key} data={data} refreshing={refreshing} reload={reload} msg={msg} setMsg={setMsg} />;
}

function SettingsForm({
  data,
  refreshing,
  reload,
  msg,
  setMsg,
}: {
  data: Settings;
  refreshing: boolean;
  reload: () => Promise<void>;
  msg: { text: string; ok: boolean } | null;
  setMsg: (m: { text: string; ok: boolean } | null) => void;
}) {
  const dialog = useDialog();
  const [name, setName] = useState(data.name);
  const [days, setDays] = useState<DayForm[]>(() =>
    data.dayRules.map((r, i) => ({ off: data.weeklyOffDays.includes(i), open: r.open, close: r.close, grace: String(r.graceMins ?? 0), any: r.anyScanFullDay })),
  );
  const [nums, setNums] = useState<Record<string, string>>({
    duplicateScanMins: String(data.duplicateScanMins),
    maxShiftHours: String(data.maxShiftHours),
    pfEmployeePct: String(data.pfEmployeePct),
    pfEmployerPct: String(data.pfEmployerPct),
    pfWageCeiling: String(data.pfWageCeiling),
    esiEmployeePct: String(data.esiEmployeePct),
    esiEmployerPct: String(data.esiEmployerPct),
  });
  const [newSite, setNewSite] = useState("");
  const [hDate, setHDate] = useState("");
  const [hName, setHName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Snapshot of the saved values. Updated after a successful save (some fields do not rebuild the form).
  const [saved, setSaved] = useState(() => JSON.stringify({ name, days, nums }));
  useUnsavedGuard(!busy && (JSON.stringify({ name, days, nums }) !== saved || !!newSite.trim() || !!hName.trim()));

  async function run(key: string, action: string, body: Record<string, unknown>, after?: () => void) {
    setBusy(key);
    setMsg(null);
    try {
      const r = await api.action(action, body);
      setMsg({ text: r.message ?? "Saved", ok: true });
      after?.();
      await reload();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy(null);
    }
  }

  const [open, setOpen] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const setDay = (i: number, patch: Partial<DayForm>) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function saveSettings() {
    const body: Record<string, unknown> = { name, ...nums };
    days.forEach((d, i) => {
      body[`open_${i}`] = d.open;
      body[`close_${i}`] = d.close;
      body[`grace_${i}`] = d.grace || "0";
      body[`off_${i}`] = d.off;
      body[`any_${i}`] = d.any;
    });
    const snapshot = JSON.stringify({ name, days, nums });
    void run("settings", "updateSettings", body, () => setSaved(snapshot));
  }

  const num = (k: string, label: string) => (
    <Field key={k} label={label} value={nums[k] ?? ""} onChangeText={(t) => setNums((n) => ({ ...n, [k]: t }))} keyboardType="decimal-pad" />
  );

  const dirty = JSON.stringify({ name, days, nums }) !== saved;
  const workDays = days.filter((d) => !d.off).length;
  const offNames = days.map((d, i) => (d.off ? DAYS[i].slice(0, 3) : null)).filter(Boolean).join(", ");
  return (
    <View style={{ flex: 1 }}>
    <Screen refreshControl={<RefreshControl {...refreshProps(refreshing, reload)} />} bottomSpace={dirty ? 90 : 0}>
      <Stack.Screen options={{ title: "Settings" }} />
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}
      <Muted>Tap a section to open it. Changes to the business, hours and rates are saved together with the button at the bottom.</Muted>

      <Section id="business" open={open} setOpen={setOpen} icon={Building} ink="blue" title="Business" summary={name}>
        <Field label="Business name" value={name} onChangeText={setName} />
        {num("duplicateScanMins", "Ignore repeat scans within (minutes)")}
        {num("maxShiftHours", "Longest shift (hours)")}
      </Section>

      <Section id="hours" open={open} setOpen={setOpen} icon={Clock} ink="teal" title="Working hours" summary={`${workDays} working days${offNames ? ` · off ${offNames}` : ""}`}>
        <Muted>Weekly off is paid for monthly staff. Grace: minutes after opening that still count as on time; a later first scan is tagged Late (full pay). Half day: punched in after the middle of the shift, or out before it. Any scan = full day: for short days like Sunday.</Muted>
        {days.map((d, i) => (
          <View key={i} style={{ borderTopWidth: 1, borderTopColor: C.hairline, paddingTop: 10, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "600", color: d.off ? C.muted : C.text, fontSize: 15 }}>{DAYS[i]}{d.off ? " · off" : <Text style={{ color: C.ink.teal, fontWeight: "500" }}>{`  ${d.open} – ${d.close}`}</Text>}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ color: C.muted, fontSize: 13 }}>Off</Text>
                <Toggle value={d.off} onValueChange={(b) => setDay(i, { off: b })} label={`${DAYS[i]} weekly off`} />
              </View>
            </View>
            {!d.off ? (
              <>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}><TimeField compact label="Opens" value={d.open} onChange={(t) => setDay(i, { open: t })} /></View>
                  <View style={{ flex: 1 }}><TimeField compact label="Closes" value={d.close} onChange={(t) => setDay(i, { close: t })} /></View>
                  <View style={{ flex: 0.8 }}><Field label="Grace (min)" value={d.grace} onChangeText={(t) => setDay(i, { grace: t.replace(/\D/g, "").slice(0, 3) })} keyboardType="number-pad" /></View>
                </View>
                {!d.any ? <Muted>{`Half day if in after or out before ${shiftMiddle(d.open, d.close)}`}{Number(d.grace) ? ` · Late after ${addMins(d.open, Number(d.grace))}` : ""}</Muted> : null}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: C.text }}>Any scan = full day</Text>
                  <Toggle value={d.any} onValueChange={(b) => setDay(i, { any: b })} label={`${DAYS[i]} any scan counts as full day`} />
                </View>
              </>
            ) : null}
          </View>
        ))}
      </Section>

      <Section id="holidays" open={open} setOpen={setOpen} icon={Beach} ink="pink" title="Holidays" summary={data.holidays.length ? `${data.holidays.length} added · paid for monthly staff` : "None added"}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><DateField label="Date" value={hDate} onChange={setHDate} /></View>
          <View style={{ flex: 1 }}><Field label="Name" value={hName} onChangeText={setHName} placeholder="e.g. Diwali" /></View>
        </View>
        <Button title="Add holiday" variant="secondary" icon={<Plus size={18} color={C.ink.pink} />} loading={busy === "holiday"} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(hDate) || !hName.trim()} onPress={() => run("holiday", "addHoliday", { date: hDate, name: hName }, () => { setHDate(""); setHName(""); })} />
        {data.holidays.map((h) => (
          <View key={h.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
            <Text style={{ color: C.text }}><Text style={{ color: C.ink.pink, fontWeight: "600" }}>{dateLabel(h.date)}</Text> · {h.name}</Text>
            <Pressable
              hitSlop={10}
              accessibilityLabel={`Remove ${h.name}`}
              onPress={async () => { if (await dialog.confirm({ title: `Remove ${h.name}?`, confirmText: "Remove", danger: true })) void run(h.id, "removeHoliday", { holidayId: h.id }); }}
            >
              <Trash2 size={18} color={C.ink.red} />
            </Pressable>
          </View>
        ))}
      </Section>

      <Section id="sites" open={open} setOpen={setOpen} icon={Building} ink="violet" title="Sites and branches" summary={`${data.sites.filter((x) => x.active).length} active`}>
        {data.sites.map((x) => (
          <View key={x.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <Text style={{ flex: 1, color: x.active ? C.text : C.muted, textDecorationLine: x.active ? "none" : "line-through", fontSize: 15 }}>{x.name}</Text>
            <Toggle value={x.active} onValueChange={() => run(x.id, "toggleSite", { siteId: x.id })} label={`${x.name} active`} disabled={busy === x.id} />
          </View>
        ))}
        <Field label="New site name" value={newSite} onChangeText={setNewSite} />
        <Button title="Add site" variant="secondary" icon={<Plus size={18} color={C.ink.violet} />} loading={busy === "site"} disabled={!newSite.trim()} onPress={() => run("site", "addSite", { name: newSite }, () => setNewSite(""))} />
      </Section>

      <Section id="rates" open={open} setOpen={setOpen} icon={Coins} ink="orange" title="PF and ESIC rates" summary={`PF ${nums.pfEmployeePct}% · ESIC ${nums.esiEmployeePct}%`}>
        <Muted>Used only for employees with PF / ESIC switched on. Check the current official rates with your accountant.</Muted>
        {num("pfEmployeePct", "PF employee %")}
        {num("pfEmployerPct", "PF employer %")}
        {num("pfWageCeiling", "PF wage ceiling (₹)")}
        {num("esiEmployeePct", "ESIC employee %")}
        {num("esiEmployerPct", "ESIC employer %")}
      </Section>
    </Screen>
    {dirty ? (
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.hairline, flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="Undo" variant="secondary" onPress={() => { const o = JSON.parse(saved); setName(o.name); setDays(o.days); setNums(o.nums); }} /></View>
        <View style={{ flex: 2 }}><Button title="Save changes" loading={busy === "settings"} onPress={saveSettings} /></View>
      </View>
    ) : null}
    </View>
  );
}

/** One collapsible settings group: icon, title and a one-line summary; tap to open. Only one is open at a time. */
function Section({ id, open, setOpen, icon: Icon, ink, title, summary, children }: { id: string; open: string | null; setOpen: (v: string | null) => void; icon: IconType; ink: Ink; title: string; summary: string; children: React.ReactNode }) {
  const isOpen = open === id;
  return (
    <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
      <Pressable onPress={() => { setOpen(isOpen ? null : id); }} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: pressed ? C.soft : "transparent" })}>
        <IconChip ink={ink}><Icon size={20} color={C.ink[ink]} /></IconChip>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>{title}</Text>
          <Text style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>{summary}</Text>
        </View>
        {isOpen ? <ChevronUp size={20} color={C.muted} /> : <ChevronDown size={20} color={C.muted} />}
      </Pressable>
      {isOpen ? <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>{children}</View> : null}
    </Card>
  );
}
