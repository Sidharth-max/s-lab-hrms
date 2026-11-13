import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react-native";
import { dateLabel, monthLabel } from "@/lib/format";
import { C, R } from "@/lib/theme";
import { Button } from "./ui";

// Native date / time pickers. Values stay as plain strings: "YYYY-MM-DD", "HH:MM" (24 h), "YYYY-MM".

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
};
const fromTime = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  const d = new Date();
  d.setHours(m ? Number(m[1]) : 9, m ? Number(m[2]) : 0, 0, 0);
  return d;
};
function time12(t: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t || "Choose time";
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

function open(mode: "date" | "time", value: Date, onPick: (d: Date) => void, limits: { min?: Date; max?: Date }, setIos: (v: { mode: "date" | "time"; value: Date } | null) => void) {
  if (Platform.OS === "android") {
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: false,
      minimumDate: limits.min,
      maximumDate: limits.max,
      onChange: (e: DateTimePickerEvent, d?: Date) => {
        if (e.type === "set" && d) onPick(d);
      },
    });
  } else {
    setIos({ mode, value });
  }
}

function Box({ label, text, icon, onPress, compact }: { label?: string; text: string; icon: React.ReactNode; onPress: () => void; compact?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label ? `${label}: ${text}` : text} style={({ pressed }) => [styles.box, compact && { paddingHorizontal: 10 }, pressed && { backgroundColor: C.soft }]}>
        <Text style={styles.boxText} numberOfLines={1}>{text}</Text>
        {icon}
      </Pressable>
    </View>
  );
}

/** iOS has no picker dialog: show the inline picker in a sheet. (The app ships for Android; this keeps other platforms usable.) */
function IosSheet({ state, onPick, onClose, limits }: { state: { mode: "date" | "time"; value: Date } | null; onPick: (d: Date) => void; onClose: () => void; limits: { min?: Date; max?: Date } }) {
  const [v, setV] = useState<Date | null>(null);
  if (!state) return null;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View style={{ backgroundColor: C.white, padding: 16, gap: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <DateTimePicker value={v ?? state.value} mode={state.mode} display="spinner" minimumDate={limits.min} maximumDate={limits.max} onChange={(_e, d) => d && setV(d)} />
          <Button title="Done" onPress={() => { onPick(v ?? state.value); setV(null); onClose(); }} />
        </View>
      </View>
    </Modal>
  );
}

export function DateField({ label, value, onChange, min, max, placeholder = "Choose date" }: { label?: string; value: string; onChange: (v: string) => void; min?: string; max?: string; placeholder?: string }) {
  const [ios, setIos] = useState<{ mode: "date" | "time"; value: Date } | null>(null);
  const limits = { min: min ? fromKey(min) : undefined, max: max ? fromKey(max) : undefined };
  if (Platform.OS === "web") {
    return (
      <View style={{ gap: 6 }}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <TextInput style={styles.box} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" />
      </View>
    );
  }
  return (
    <>
      <Box label={label} text={value ? dateLabel(value) : placeholder} icon={<CalendarDays size={18} color={C.muted} strokeWidth={1.75} />} onPress={() => open("date", value ? fromKey(value) : new Date(), (d) => onChange(toKey(d)), limits, setIos)} />
      <IosSheet state={ios} limits={limits} onPick={(d) => onChange(toKey(d))} onClose={() => setIos(null)} />
    </>
  );
}

export function TimeField({ label, value, onChange, compact }: { label?: string; value: string; onChange: (v: string) => void; compact?: boolean }) {
  const [ios, setIos] = useState<{ mode: "date" | "time"; value: Date } | null>(null);
  if (Platform.OS === "web") {
    return (
      <View style={{ gap: 6 }}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <TextInput style={styles.box} value={value} onChangeText={onChange} placeholder="HH:MM" maxLength={5} />
      </View>
    );
  }
  const pick = (d: Date) => onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  return (
    <>
      <Box label={label} compact={compact} text={time12(value)} icon={<Clock size={16} color={C.muted} strokeWidth={1.75} />} onPress={() => open("time", fromTime(value), pick, {}, setIos)} />
      <IosSheet state={ios} limits={{}} onPick={pick} onClose={() => setIos(null)} />
    </>
  );
}

function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
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

/** Opens the native date dialog directly (e.g. from a header "pick date" button). */
export function pickDate(value: string, onChange: (v: string) => void, max?: string) {
  if (Platform.OS !== "android") return false;
  open("date", fromKey(value), (d) => onChange(toKey(d)), { max: max ? fromKey(max) : undefined }, () => {});
  return true;
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "500", color: C.muted },
  box: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.md,
    paddingHorizontal: 12,
    backgroundColor: C.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 15,
    color: C.text,
  },
  boxText: { flex: 1, fontSize: 15, color: C.text },
});
