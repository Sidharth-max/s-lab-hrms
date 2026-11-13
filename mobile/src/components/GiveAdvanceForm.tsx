import { useState } from "react";
import { View } from "react-native";
import { HandCoins } from "./icons";
import { Button, Card, Field, H2, Muted } from "./ui";
import { DateField } from "./pickers";
import { EmployeePicker, type PickEmployee } from "./EmployeePicker";
import { api } from "@/lib/api";
import { rs } from "@/lib/format";
import { useUnsavedGuard } from "@/lib/unsaved";

function istToday() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

/**
 * Give an advance. On an employee's page the employee is fixed; on the Advances page
 * (pass `employees`) the person is chosen first.
 */
export function GiveAdvanceForm({
  employeeId: fixedId,
  employees,
  onDone,
  onDirty,
  bare,
}: {
  employeeId?: string;
  employees?: PickEmployee[];
  onDone: (m: { text: string; ok: boolean }) => Promise<void> | void;
  onDirty?: (dirty: boolean) => void;
  /** Inside a sheet: no card frame and no heading (the sheet has its own title). */
  bare?: boolean;
}) {
  const [employeeId, setEmployeeId] = useState(fixedId ?? "");
  const [amount, setAmountRaw] = useState("");
  const [givenOn, setGivenOn] = useState(istToday());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useUnsavedGuard(!busy && (!!amount || !!note));
  const setAmount = (t: string) => {
    setAmountRaw(t);
    onDirty?.(!!t);
  };
  const Frame = bare ? View : Card;
  const n = Number(amount);
  return (
    <Frame style={bare ? { gap: 12 } : undefined}>
      {bare ? null : <H2>Give advance</H2>}
      <Muted>The advance comes off the salary balance straight away.</Muted>
      {!fixedId && employees ? <EmployeePicker employees={employees} value={employeeId} onChange={setEmployeeId} /> : null}
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 2000" />
      <DateField label="Given on" value={givenOn} onChange={setGivenOn} max={istToday()} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. medical…" />
      <Button
        title={n > 0 ? `Give ${rs(Math.round(n * 100))} advance` : "Give advance"}
        icon={<HandCoins size={18} color="#ffffff" />}
        loading={busy}
        disabled={!amount || !employeeId}
        onPress={async () => {
          setBusy(true);
          try {
            const r = await api.action("giveAdvance", { employeeId, amount, givenOn, note });
            setAmount("");
            setNote("");
            if (!fixedId) setEmployeeId("");
            await onDone({ text: r.message ?? "Saved", ok: true });
          } catch (e) {
            await onDone({ text: (e as Error).message, ok: false });
          } finally {
            setBusy(false);
          }
        }}
      />
    </Frame>
  );
}
