import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Sheet as BaseSheet } from "./Sheet";
import { haptic } from "@/lib/haptics";
import { Text } from "@/components/Text";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Minus, Plus } from "@/components/icons";
import { dateLabel, monthLabel } from "@/lib/format";
import { C, R } from "@/lib/theme";
import { Button, Segmented } from "./ui";

// Our own date, time and month pickers (no Android system dialogs).
// Values stay plain strings: "YYYY-MM-DD", "HH:MM" (24 h), "YYYY-MM".

const pad = (n: number) => String(n).padStart(2, "0");
const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

function todayKey() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

function time12(t: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return "Choose time";
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

/** Bottom sheet frame shared by the pickers. */
function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return <BaseSheet visible={visible} title={title} onClose={onClose} maxWidth={520}>{children}</BaseSheet>;
}

/** Month calendar in a sheet. */
export function DatePickerSheet({ visible, value, onChange, onClose, min, max, title = "Choose date" }: { visible: boolean; value: string; onChange: (v: string) => void; onClose: () => void; min?: string; max?: string; title?: string }) {
  const start = (value || todayKey()).slice(0, 7);
  // Mounted only while open (see the fields below), so it always starts at the selected month.
  const [shown, setShown] = useState(start);
  const [y, m] = shown.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => `${shown}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const today = todayKey();
  const ok = (d: string) => (!min || d >= min) && (!max || d <= max);
  const canBack = !min || shiftMonth(shown, -1) >= min.slice(0, 7);
  const canNext = !max || shiftMonth(shown, 1) <= max.slice(0, 7);
  const pick = (d: string) => {
    haptic.select();
    onChange(d);
    onClose();
  };
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => canBack && setShown(shiftMonth(shown, -1))} hitSlop={10} style={[styles.nav, !canBack && { opacity: 0.3 }]} accessibilityLabel="Previous month">
          <ChevronLeft size={20} color={C.text} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>{monthLabel(shown)}</Text>
        <Pressable onPress={() => canNext && setShown(shiftMonth(shown, 1))} hitSlop={10} style={[styles.nav, !canNext && { opacity: 0.3 }]} accessibilityLabel="Next month">
          <ChevronRight size={20} color={C.text} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {WEEK.map((d, i) => <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600", color: C.muted }}>{d}</Text>)}
      </View>
      <View style={{ gap: 4 }}>
        {Array.from({ length: cells.length / 7 }, (_, w) => (
          <View key={w} style={{ flexDirection: "row", gap: 4 }}>
            {cells.slice(w * 7, w * 7 + 7).map((d, i) => {
              if (!d) return <View key={i} style={{ flex: 1, height: 42 }} />;
              const sel = d === value;
              const enabled = ok(d);
              return (
                <Pressable
                  key={i}
                  disabled={!enabled}
                  onPress={() => pick(d)}
                  accessibilityLabel={dateLabel(d)}
                  style={({ pressed }) => [
                    { flex: 1, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
                    sel ? { backgroundColor: C.brand } : d === today ? { borderWidth: 1.5, borderColor: C.brand } : null,
                    pressed && !sel && { backgroundColor: C.soft },
                  ]}
                >
                  <Text style={{ fontSize: 15, fontWeight: sel || d === today ? "700" : "400", color: sel ? "#ffffff" : d === today ? C.brandInk : enabled ? C.text : C.faint }}>{Number(d.slice(8))}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="Cancel" variant="secondary" onPress={onClose} /></View>
        <View style={{ flex: 1 }}><Button title="Today" disabled={!ok(today)} onPress={() => pick(today)} /></View>
      </View>
    </Sheet>
  );
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function TimePickerSheet({ visible, value, onChange, onClose, title = "Choose time" }: { visible: boolean; value: string; onChange: (v: string) => void; onClose: () => void; title?: string }) {
  const parse = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t);
    return m ? { h: Number(m[1]), m: Number(m[2]) } : { h: 9, m: 0 };
  };
  const [t, setT] = useState(() => parse(value));
  const pm = t.h >= 12;
  const h12 = ((t.h + 11) % 12) + 1;
  const setHour12 = (h: number) => setT((o) => ({ ...o, h: (h % 12) + (o.h >= 12 ? 12 : 0) }));
  const setPm = (p: boolean) => setT((o) => ({ ...o, h: (o.h % 12) + (p ? 12 : 0) }));
  const nudge = (by: number) => setT((o) => {
    const total = (o.h * 60 + o.m + by + 1440) % 1440;
    return { h: Math.floor(total / 60), m: total % 60 };
  });
  const chip = (on: boolean) => [styles.chip, on && { backgroundColor: C.gradient[1], borderColor: C.gradient[1] }];
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Pressable onPress={() => nudge(-1)} hitSlop={8} style={styles.nav} accessibilityLabel="One minute earlier"><Minus size={18} color={C.text} /></Pressable>
        <Text style={{ fontSize: 32, fontWeight: "700", color: C.text, minWidth: 150, textAlign: "center" }}>{time12(`${t.h}:${pad(t.m)}`)}</Text>
        <Pressable onPress={() => nudge(1)} hitSlop={8} style={styles.nav} accessibilityLabel="One minute later"><Plus size={18} color={C.text} /></Pressable>
      </View>
      <Segmented options={[{ value: "am", label: "AM" }, { value: "pm", label: "PM" }]} value={pm ? "pm" : "am"} onChange={(v) => setPm(v === "pm")} />
      <Text style={styles.label}>Hour</Text>
      <View style={styles.grid}>
        {HOURS.map((h) => (
          <Pressable key={h} onPress={() => setHour12(h)} style={chip(h12 === h)}>
            <Text style={[styles.chipText, h12 === h && { color: "#ffffff" }]}>{h}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Minute</Text>
      <View style={styles.grid}>
        {MINUTES.map((mm) => (
          <Pressable key={mm} onPress={() => setT((o) => ({ ...o, m: mm }))} style={chip(t.m === mm)}>
            <Text style={[styles.chipText, t.m === mm && { color: "#ffffff" }]}>{pad(mm)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="Cancel" variant="secondary" onPress={onClose} /></View>
        <View style={{ flex: 1 }}><Button title="Done" onPress={() => { onChange(`${pad(t.h)}:${pad(t.m)}`); onClose(); }} /></View>
      </View>
    </Sheet>
  );
}

function Box({ label, text, icon, onPress, compact, placeholder }: { label?: string; text: string; icon: React.ReactNode; onPress: () => void; compact?: boolean; placeholder?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label ? `${label}: ${text}` : text} style={({ pressed }) => [styles.box, compact && { paddingHorizontal: 10 }, pressed && { backgroundColor: C.soft }]}>
        <Text style={[styles.boxText, placeholder && { color: C.placeholder }]} numberOfLines={1}>{text}</Text>
        {icon}
      </Pressable>
    </View>
  );
}

export function DateField({ label, value, onChange, min, max, placeholder = "Choose date" }: { label?: string; value: string; onChange: (v: string) => void; min?: string; max?: string; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Box label={label} text={value ? dateLabel(value) : placeholder} placeholder={!value} icon={<CalendarDays size={18} color={C.muted} />} onPress={() => setOpen(true)} />
      {open ? <DatePickerSheet visible value={value} onChange={onChange} onClose={() => setOpen(false)} min={min} max={max} title={label} /> : null}
    </>
  );
}

export function TimeField({ label, value, onChange, compact }: { label?: string; value: string; onChange: (v: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Box label={label} compact={compact} text={time12(value)} placeholder={!value} icon={<Clock size={16} color={C.muted} />} onPress={() => setOpen(true)} />
      {open ? <TimePickerSheet visible value={value} onChange={onChange} onClose={() => setOpen(false)} title={label} /> : null}
    </>
  );
}

/** Month chooser with previous / next buttons. */
export function MonthField({ label, value, onChange, min, max }: { label?: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  const canBack = !min || value > min;
  const canNext = !max || value < max;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.box, { paddingHorizontal: 4 }]}>
        <Pressable onPress={() => canBack && onChange(shiftMonth(value, -1))} hitSlop={8} style={{ padding: 6, opacity: canBack ? 1 : 0.3 }} accessibilityLabel="Previous month">
          <ChevronLeft size={20} color={C.text} />
        </Pressable>
        <Text style={[styles.boxText, { textAlign: "center" }]}>{monthLabel(value)}</Text>
        <Pressable onPress={() => canNext && onChange(shiftMonth(value, 1))} hitSlop={8} style={{ padding: 6, opacity: canNext ? 1 : 0.3 }} accessibilityLabel="Next month">
          <ChevronRight size={20} color={C.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "500", color: C.muted },
  box: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: R.md + 2,
    paddingHorizontal: 14,
    backgroundColor: C.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  boxText: { flex: 1, fontSize: 15, color: C.text },
  nav: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { width: "22%", flexGrow: 1, height: 40, borderRadius: R.md, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", backgroundColor: C.white },
  chipText: { fontSize: 15, fontWeight: "600", color: C.text },
});
