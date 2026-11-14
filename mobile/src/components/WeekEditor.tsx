import { View } from "react-native";
import { Text } from "./Text";
import { Field, Muted, Toggle } from "./ui";
import { TimeField } from "./pickers";
import { C } from "@/lib/theme";

// Per-weekday schedule editor: used for the business hours (Settings) and for each shift.

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface DayRule { open: string; close: string; halfDayBelowMins: number; anyScanFullDay: boolean; graceMins?: number; graceOutMins?: number }
export interface DayForm { off: boolean; open: string; close: string; grace: string; graceOut: string; any: boolean }

export const SCHEDULE_HELP =
  "Weekly off is paid for monthly staff. Grace in: minutes after the start that still count as on time (later = Late). Grace out: minutes before the end someone may leave (earlier = Left early). Both are tags only, full pay. Half day: in after the middle of the shift, or out before it. Any scan = full day: for short days like Sunday.";

export function toDayForms(rules: DayRule[], weeklyOff: number[]): DayForm[] {
  return rules.map((r, i) => ({ off: weeklyOff.includes(i), open: r.open, close: r.close, grace: String(r.graceMins ?? 0), graceOut: String(r.graceOutMins ?? 0), any: r.anyScanFullDay }));
}

/** The same field names the website sends (open_i, close_i, grace_i, graceout_i, off_i, any_i). */
export function dayFormBody(days: DayForm[]) {
  const body: Record<string, unknown> = {};
  days.forEach((d, i) => {
    body[`open_${i}`] = d.open;
    body[`close_${i}`] = d.close;
    body[`grace_${i}`] = d.grace || "0";
    body[`graceout_${i}`] = d.graceOut || "0";
    body[`off_${i}`] = d.off;
    body[`any_${i}`] = d.any;
  });
  return body;
}

const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export function fmt12(min: number) {
  const x = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(x / 60);
  return `${((h + 11) % 12) + 1}:${String(x % 60).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}
/** Middle of the shift (same rule as the server): punched in after it or out before it = half day. */
function shiftMiddle(open: string, close: string) {
  let span = m(close) - m(open);
  if (span <= 0) span += 1440;
  return fmt12(m(open) + Math.floor(span / 2));
}

/** "9:00 am to 6:00 pm · off Sun" */
export function weekSummary(days: DayForm[]) {
  const work = days.filter((d) => !d.off);
  if (!work.length) return "No working days";
  const first = days[1] && !days[1].off ? days[1] : work[0];
  const same = work.every((d) => d.open === first.open && d.close === first.close);
  const off = days.map((d, i) => (d.off ? DAYS[i].slice(0, 3) : null)).filter(Boolean).join(", ");
  return `${same ? `${fmt12(m(first.open))} to ${fmt12(m(first.close))}` : "times differ by day"}${off ? ` · off ${off}` : ""}`;
}

export function WeekEditor({ days, setDays }: { days: DayForm[]; setDays: (f: (d: DayForm[]) => DayForm[]) => void }) {
  const setDay = (i: number, patch: Partial<DayForm>) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const digits = (t: string) => t.replace(/\D/g, "").slice(0, 3);
  return (
    <>
      <Muted>{SCHEDULE_HELP}</Muted>
      {days.map((d, i) => (
        <View key={i} style={{ borderTopWidth: 1, borderTopColor: C.hairline, paddingTop: 10, gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontWeight: "600", color: d.off ? C.muted : C.text, fontSize: 15 }}>
              {DAYS[i]}
              {d.off ? " · off" : <Text style={{ color: C.ink.teal, fontWeight: "500" }}>{`  ${d.open} – ${d.close}`}</Text>}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: C.muted, fontSize: 13 }}>Off</Text>
              <Toggle value={d.off} onValueChange={(b) => setDay(i, { off: b })} label={`${DAYS[i]} weekly off`} />
            </View>
          </View>
          {!d.off ? (
            <>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><TimeField compact label="Starts" value={d.open} onChange={(t) => setDay(i, { open: t })} /></View>
                <View style={{ flex: 1 }}><TimeField compact label="Ends" value={d.close} onChange={(t) => setDay(i, { close: t })} /></View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Field label="Grace in (min)" value={d.grace} onChangeText={(t) => setDay(i, { grace: digits(t) })} keyboardType="number-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Grace out (min)" value={d.graceOut} onChangeText={(t) => setDay(i, { graceOut: digits(t) })} keyboardType="number-pad" /></View>
              </View>
              {!d.any ? (
                <Muted>
                  {`Half day if in after or out before ${shiftMiddle(d.open, d.close)}`}
                  {Number(d.grace) ? ` · Late after ${fmt12(m(d.open) + Number(d.grace))}` : ""}
                  {Number(d.graceOut) ? ` · Left early before ${fmt12(m(d.close) - Number(d.graceOut))}` : ""}
                </Muted>
              ) : null}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: C.text }}>Any scan = full day</Text>
                <Toggle value={d.any} onValueChange={(b) => setDay(i, { any: b })} label={`${DAYS[i]} any scan counts as full day`} />
              </View>
            </>
          ) : null}
        </View>
      ))}
    </>
  );
}
