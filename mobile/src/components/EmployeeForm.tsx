import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/Text";
import { Button, Field, Muted, Notice, Segmented, Toggle } from "./ui";
import { C } from "@/lib/theme";
import { DateField } from "./pickers";
import { useUnsavedGuard } from "@/lib/unsaved";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface EmployeeValues {
  name: string;
  code: string;
  phone: string;
  siteId: string;
  joinedOn: string;
  wageType: "MONTHLY" | "DAILY";
  wage: string;
  basicPercent: string;
  pfEnabled: boolean;
  esiEnabled: boolean;
  uanNumber?: string;
  esicNumber?: string;
  customWeeklyOff: boolean;
  inHouse?: boolean;
  weeklyOffDays: number[];
}

export function EmployeeForm({
  initial,
  sites,
  isNew,
  canSalary,
  submitTitle,
  onSubmit,
}: {
  initial: EmployeeValues;
  sites: { id: string; name: string }[];
  isNew: boolean;
  canSalary: boolean;
  submitTitle: string;
  onSubmit: (v: EmployeeValues) => Promise<string | null>;
}) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Warn on back while there are unsaved changes (not while saving: the screen closes after a save).
  useUnsavedGuard(!busy && JSON.stringify(v) !== JSON.stringify(initial));
  const set = <K extends keyof EmployeeValues>(k: K, val: EmployeeValues[K]) => setV((o) => ({ ...o, [k]: val }));

  return (
    <View style={{ gap: 14 }}>
      <Field label="Full name" value={v.name} onChangeText={(t) => set("name", t)} />
      {isNew ? (
        <Field
          label="Employee code"
          hint="Filled in automatically. Leave it, or type your own."
          placeholder="Automatic"
          value={v.code}
          onChangeText={(t) => set("code", t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={12}
        />
      ) : null}
      <Field label="Mobile (optional, needed for web login)" value={v.phone} onChangeText={(t) => set("phone", t)} keyboardType="phone-pad" />
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Site</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {sites.map((s) => (
            <Pressable key={s.id} onPress={() => set("siteId", s.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: v.siteId === s.id ? C.text : C.line, backgroundColor: v.siteId === s.id ? C.text : C.white }}>
              <Text style={{ color: v.siteId === s.id ? C.white : C.text, fontWeight: "500" }}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <DateField label="Joining date" value={v.joinedOn} onChange={(t) => set("joinedOn", t)} />

      {isNew || canSalary ? (
        <>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Paid</Text>
            <Segmented options={[{ value: "MONTHLY", label: "Monthly salary" }, { value: "DAILY", label: "Daily wage" }]} value={v.wageType} onChange={(t) => set("wageType", t)} />
          </View>
          <Field label={v.wageType === "MONTHLY" ? "Salary per month (₹)" : "Wage per day (₹)"} value={v.wage} onChangeText={(t) => set("wage", t)} keyboardType="decimal-pad" />
          <Field label="Basic % of wage (used for PF)" value={v.basicPercent} onChangeText={(t) => set("basicPercent", t)} keyboardType="number-pad" maxLength={3} />
          {canSalary ? (
            <View style={{ gap: 8 }}>
              <View style={{ gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>PF deduction</Text>
                  <Toggle value={v.pfEnabled} onValueChange={(b) => set("pfEnabled", b)} label="PF deduction" />
                </View>
                {v.pfEnabled ? <Field label="PF UAN (12 digits, optional)" value={v.uanNumber ?? ""} onChangeText={(t) => set("uanNumber", t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={12} placeholder="e.g. 100123456789" /> : null}
              </View>
              <View style={{ gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>ESIC deduction</Text>
                  <Toggle value={v.esiEnabled} onValueChange={(b) => set("esiEnabled", b)} label="ESIC deduction" />
                </View>
                {v.esiEnabled ? <Field label="ESIC IP number (10 digits, optional)" value={v.esicNumber ?? ""} onChangeText={(t) => set("esicNumber", t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={10} placeholder="e.g. 3112345678" /> : null}
              </View>
            </View>
          ) : (
            <Muted>PF / ESIC stay off. A user with salary permission can turn them on.</Muted>
          )}
        </>
      ) : null}

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginBottom: 6 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>In-house employee</Text>
            <Text style={{ fontSize: 13, color: C.muted, lineHeight: 18 }}>Present automatically on every working day, no scan needed. Scanning still works and always counts as a full day.</Text>
          </View>
          <Toggle value={!!v.inHouse} onValueChange={(b) => set("inHouse", b)} label="In-house employee" />
        </View>
        <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Weekly off</Text>
        <Segmented options={[{ value: "business", label: "Same as business" }, { value: "custom", label: "Own days" }]} value={v.customWeeklyOff ? "custom" : "business"} onChange={(m) => set("customWeeklyOff", m === "custom")} />
        {v.customWeeklyOff ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {DAYS.map((d, i) => {
              const on = v.weeklyOffDays.includes(i);
              return (
                <Pressable key={d} onPress={() => set("weeklyOffDays", on ? v.weeklyOffDays.filter((x) => x !== i) : [...v.weeklyOffDays, i])} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? C.text : C.line, backgroundColor: on ? C.text : C.white }}>
                  <Text style={{ color: on ? C.white : C.text }}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {error ? <Notice tone="red" text={error} /> : null}
      <Button
        title={submitTitle}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setError(await onSubmit(v));
          setBusy(false);
        }}
      />
    </View>
  );
}

/** Body for the server's employee actions. */
export function employeeBody(v: EmployeeValues, canSalary: boolean, isNew: boolean) {
  return {
    name: v.name,
    ...(isNew ? { code: v.code } : {}),
    phone: v.phone,
    siteId: v.siteId,
    joinedOn: v.joinedOn,
    ...(isNew || canSalary
      ? { wageType: v.wageType, wage: v.wage, basicPercent: v.basicPercent || "100", pfEnabled: canSalary && v.pfEnabled, esiEnabled: canSalary && v.esiEnabled, uanNumber: v.uanNumber ?? "", esicNumber: v.esicNumber ?? "" }
      : {}),
    weeklyOffMode: v.customWeeklyOff ? "custom" : "business",
    inHouse: !!v.inHouse,
    empWeeklyOff: v.customWeeklyOff ? v.weeklyOffDays : [],
  };
}
