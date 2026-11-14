import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/Text";
import { Button, ChoiceChip, Field, Muted, Notice, Segmented, Toggle } from "./ui";
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
  /** Bank part of the wage (PF / ESIC are worked out on this). Total = wage + cashWage. */
  wage: string;
  /** Cash part of the wage (no PF / ESIC). */
  cashWage?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankAccountNumber2?: string;
  bankIfsc?: string;
  upiId?: string;
  /** Shown only: filled in by the server from the IFSC. */
  bankName?: string;
  basicPercent: string;
  pfEnabled: boolean;
  esiEnabled: boolean;
  uanNumber?: string;
  esicNumber?: string;
  customWeeklyOff: boolean;
  inHouse?: boolean;
  wageFrom?: string; // editing: day the new salary starts
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
  /** Call `allowLeave()` right before navigating away after a successful save. */
  onSubmit: (v: EmployeeValues, allowLeave: () => void) => Promise<string | null>;
}) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Warn on back while there are unsaved changes (not while saving: the screen closes after a save).
  // Saving and then leaving must call allowLeave(): `!busy` alone did not reach the guard in time, so
  // after "Add employee" the app showed "Discard changes?" and stayed on the form (tapping again added
  // the same person twice).
  const { allowLeave } = useUnsavedGuard(!busy && JSON.stringify(v) !== JSON.stringify(initial));
  const [wageFrom, setWageFrom] = useState(() => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10));
  const wageChanged = !isNew && (Number(v.wage || 0) !== Number(initial.wage || 0) || Number(v.cashWage || 0) !== Number(initial.cashWage || 0) || v.wageType !== initial.wageType);
  const totalWage = (Number(v.wage) || 0) + (Number(v.cashWage) || 0);
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
            <ChoiceChip key={s.id} label={s.name} selected={v.siteId === s.id} onPress={() => set("siteId", s.id)} />
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
          {/* Two parts: bank (PF / ESIC on this) and cash. Total = bank + cash. */}
          <View style={{ gap: 8, borderWidth: 1, borderColor: C.hairline, borderRadius: 14, padding: 12 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Field label={v.wageType === "MONTHLY" ? "Bank / month (₹)" : "Bank / day (₹)"} value={v.wage} onChangeText={(t) => set("wage", t)} keyboardType="decimal-pad" placeholder="0" /></View>
              <View style={{ flex: 1 }}><Field label={v.wageType === "MONTHLY" ? "Cash / month (₹)" : "Cash / day (₹)"} value={v.cashWage ?? ""} onChangeText={(t) => set("cashWage", t)} keyboardType="decimal-pad" placeholder="0" /></View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: C.muted, fontSize: 13 }}>{v.wageType === "MONTHLY" ? "Total salary per month" : "Total wage per day"}</Text>
              <Text style={{ color: C.ink.violet, fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{`₹${totalWage.toLocaleString("en-IN")}`}</Text>
            </View>
            <Muted>PF and ESIC are worked out on the bank part only.</Muted>
          </View>
          {wageChanged ? (
            <View style={{ gap: 6, borderWidth: 1, borderColor: C.amberLine, backgroundColor: C.amberSoft, borderRadius: 12, padding: 12 }}>
              <DateField label="New salary applies from" value={wageFrom} onChange={setWageFrom} min={v.joinedOn} />
              <Text style={{ fontSize: 13, color: C.muted, lineHeight: 18 }}>Days before this keep the old salary. Days from this date use the new one. Nothing already earned is lost.</Text>
            </View>
          ) : null}
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
          {canSalary ? (
            <View style={{ gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>Bank details (optional)</Text>
              <Field label="Account holder name" value={v.bankAccountName ?? ""} onChangeText={(t) => set("bankAccountName", t)} placeholder="As on the bank account" />
              <Field label="Account number" value={v.bankAccountNumber ?? ""} onChangeText={(t) => set("bankAccountNumber", t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={18} autoComplete="off" />
              <Field label="Account number again" value={v.bankAccountNumber2 ?? ""} onChangeText={(t) => set("bankAccountNumber2", t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={18} autoComplete="off" contextMenuHidden />
              {v.bankAccountNumber && v.bankAccountNumber2 && v.bankAccountNumber !== v.bankAccountNumber2 ? <Text style={{ color: C.ink.red, fontSize: 13 }}>The two account numbers do not match</Text> : null}
              <Field label="IFSC" value={v.bankIfsc ?? ""} onChangeText={(t) => set("bankIfsc", t.toUpperCase().replace(/[^A-Z0-9]/g, ""))} autoCapitalize="characters" maxLength={11} placeholder="e.g. SBIN0001234" hint={v.bankName ? v.bankName : "Bank and branch are filled in from the IFSC."} />
              <Field label="UPI ID" value={v.upiId ?? ""} onChangeText={(t) => set("upiId", t.trim())} autoCapitalize="none" autoComplete="off" placeholder="e.g. name@okaxis" />
            </View>
          ) : null}
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
                <ChoiceChip key={d} label={d} selected={on} onPress={() => set("weeklyOffDays", on ? v.weeklyOffDays.filter((x) => x !== i) : [...v.weeklyOffDays, i])} />
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
          setError(await onSubmit(wageChanged ? { ...v, wageFrom } : v, allowLeave));
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
      ? { wageType: v.wageType, bankWage: v.wage || "0", cashWage: v.cashWage || "0", basicPercent: v.basicPercent || "100", pfEnabled: canSalary && v.pfEnabled, esiEnabled: canSalary && v.esiEnabled, uanNumber: v.uanNumber ?? "", esicNumber: v.esicNumber ?? "", wageFrom: v.wageFrom ?? "" }
      : {}),
    ...(canSalary
      ? { bankAccountName: v.bankAccountName ?? "", bankAccountNumber: v.bankAccountNumber ?? "", bankAccountNumber2: v.bankAccountNumber2 ?? "", bankIfsc: v.bankIfsc ?? "", upiId: v.upiId ?? "" }
      : {}),
    weeklyOffMode: v.customWeeklyOff ? "custom" : "business",
    inHouse: !!v.inHouse,
    empWeeklyOff: v.customWeeklyOff ? v.weeklyOffDays : [],
  };
}
