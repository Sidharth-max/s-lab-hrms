import { Stack } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, Switch, Text, View } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import { Button, Card, ErrorView, Field, H2, Loading, Muted, Notice, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface DayRule { open: string; close: string; halfDayBelowMins: number; anyScanFullDay: boolean }
interface Settings {
  name: string; weeklyOffDays: number[]; dayRules: DayRule[]; duplicateScanMins: number; maxShiftHours: number;
  pfEmployeePct: number; pfEmployerPct: number; pfWageCeiling: number; esiEmployeePct: number; esiEmployerPct: number;
  sites: { id: string; name: string; active: boolean }[];
  holidays: { id: string; date: string; name: string }[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DayForm { off: boolean; open: string; close: string; half: string; any: boolean }

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
  const [name, setName] = useState(data.name);
  const [days, setDays] = useState<DayForm[]>(() =>
    data.dayRules.map((r, i) => ({ off: data.weeklyOffDays.includes(i), open: r.open, close: r.close, half: String(r.halfDayBelowMins / 60), any: r.anyScanFullDay })),
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

  const setDay = (i: number, patch: Partial<DayForm>) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function saveSettings() {
    const body: Record<string, unknown> = { name, ...nums };
    days.forEach((d, i) => {
      body[`open_${i}`] = d.open;
      body[`close_${i}`] = d.close;
      body[`half_${i}`] = d.half || "0";
      body[`off_${i}`] = d.off;
      body[`any_${i}`] = d.any;
    });
    void run("settings", "updateSettings", body);
  }

  const num = (k: string, label: string) => (
    <Field key={k} label={label} value={nums[k] ?? ""} onChangeText={(t) => setNums((n) => ({ ...n, [k]: t }))} keyboardType="decimal-pad" />
  );

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Stack.Screen options={{ title: "Settings" }} />
      {msg ? <Notice tone={msg.ok ? "green" : "red"} text={msg.text} /> : null}

      <Card>
        <H2>Business</H2>
        <Field label="Business name" value={name} onChangeText={setName} />
        {num("duplicateScanMins", "Ignore repeat scans within (minutes)")}
        {num("maxShiftHours", "Longest shift (hours)")}
      </Card>

      <Card>
        <H2>Weekly schedule</H2>
        <Muted>Weekly off is paid for monthly staff. Half day: worked less than these hours (0 = never). Any scan = full day: for short days like Sunday.</Muted>
        {days.map((d, i) => (
          <View key={i} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "600", color: C.text, fontSize: 15 }}>{DAYS[i]}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ color: C.muted }}>Weekly off</Text>
                <Switch value={d.off} onValueChange={(b) => setDay(i, { off: b })} trackColor={{ true: C.green, false: C.line }} />
              </View>
            </View>
            {!d.off ? (
              <>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}><Field label="Opens" value={d.open} onChangeText={(t) => setDay(i, { open: t })} maxLength={5} keyboardType="numbers-and-punctuation" /></View>
                  <View style={{ flex: 1 }}><Field label="Closes" value={d.close} onChangeText={(t) => setDay(i, { close: t })} maxLength={5} keyboardType="numbers-and-punctuation" /></View>
                  <View style={{ flex: 1 }}><Field label="Half day (h)" value={d.half} onChangeText={(t) => setDay(i, { half: t })} keyboardType="decimal-pad" /></View>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: C.text }}>Any scan = full day</Text>
                  <Switch value={d.any} onValueChange={(b) => setDay(i, { any: b })} trackColor={{ true: C.green, false: C.line }} />
                </View>
              </>
            ) : null}
          </View>
        ))}
      </Card>

      <Card>
        <H2>PF and ESIC rates</H2>
        <Muted>Used only for employees with PF / ESIC switched on. Check the current official rates with your accountant.</Muted>
        {num("pfEmployeePct", "PF employee %")}
        {num("pfEmployerPct", "PF employer %")}
        {num("pfWageCeiling", "PF wage ceiling (₹)")}
        {num("esiEmployeePct", "ESIC employee %")}
        {num("esiEmployerPct", "ESIC employer %")}
      </Card>
      <Button title="Save settings" loading={busy === "settings"} onPress={saveSettings} />

      <Card>
        <H2>Sites / branches</H2>
        {data.sites.map((s) => (
          <View key={s.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: s.active ? C.text : C.muted, textDecorationLine: s.active ? "none" : "line-through", fontSize: 15 }}>{s.name}</Text>
            <Button title={s.active ? "Disable" : "Enable"} variant="secondary" loading={busy === s.id} onPress={() => run(s.id, "toggleSite", { siteId: s.id })} />
          </View>
        ))}
        <Field label="New site name" value={newSite} onChangeText={setNewSite} />
        <Button title="Add site" variant="secondary" icon={<Plus size={18} color={C.text} />} loading={busy === "site"} disabled={!newSite.trim()} onPress={() => run("site", "addSite", { name: newSite }, () => setNewSite(""))} />
      </Card>

      <Card>
        <H2>Holidays (paid for monthly staff)</H2>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Date (YYYY-MM-DD)" value={hDate} onChangeText={setHDate} maxLength={10} keyboardType="numbers-and-punctuation" /></View>
          <View style={{ flex: 1 }}><Field label="Name" value={hName} onChangeText={setHName} /></View>
        </View>
        <Button title="Add holiday" variant="secondary" icon={<Plus size={18} color={C.text} />} loading={busy === "holiday"} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(hDate) || !hName.trim()} onPress={() => run("holiday", "addHoliday", { date: hDate, name: hName }, () => { setHDate(""); setHName(""); })} />
        {data.holidays.length === 0 ? <Muted>No holidays added.</Muted> : null}
        {data.holidays.map((h) => (
          <View key={h.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: C.text }}>{dateLabel(h.date)} · {h.name}</Text>
            <Pressable
              hitSlop={10}
              accessibilityLabel={`Remove ${h.name}`}
              onPress={() => Alert.alert(`Remove ${h.name}?`, undefined, [{ text: "Cancel" }, { text: "Remove", style: "destructive", onPress: () => run(h.id, "removeHoliday", { holidayId: h.id }) }])}
            >
              <Trash2 size={18} color={C.red} />
            </Pressable>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
