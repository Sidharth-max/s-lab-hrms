import { useState } from "react";
import { Text } from "./Text";
import { HandCoins } from "./icons";
import { Button, Card, Field, H2, Segmented } from "./ui";
import { DateField, MonthField } from "./pickers";
import { EmployeePicker, type PickEmployee } from "./EmployeePicker";
import { api } from "@/lib/api";
import { C } from "@/lib/theme";
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
}: {
  employeeId?: string;
  employees?: PickEmployee[];
  onDone: (m: { text: string; ok: boolean }) => Promise<void> | void;
  onDirty?: (dirty: boolean) => void;
}) {
  const [employeeId, setEmployeeId] = useState(fixedId ?? "");
  const [amount, setAmountRaw] = useState("");
  const [months, setMonths] = useState("1");
  const [givenOn, setGivenOn] = useState(istToday());
  const [startMonth, setStartMonth] = useState(istToday().slice(0, 7));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useUnsavedGuard(!busy && (!!amount || !!note));
  const setAmount = (t: string) => {
    setAmountRaw(t);
    onDirty?.(!!t);
  };
  return (
    <Card>
      <H2>Give advance</H2>
      {!fixedId && employees ? <EmployeePicker employees={employees} value={employeeId} onChange={setEmployeeId} /> : null}
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 2000" />
      <DateField label="Given on" value={givenOn} onChange={setGivenOn} max={istToday()} />
      <Text style={{ fontSize: 13, fontWeight: "500", color: C.muted }}>Recover over</Text>
      <Segmented options={[{ value: "1", label: "Full" }, { value: "2", label: "2 m" }, { value: "3", label: "3 m" }, { value: "6", label: "6 m" }, { value: "12", label: "12 m" }]} value={months} onChange={setMonths} />
      <MonthField label="First recovery month" value={startMonth} onChange={setStartMonth} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. medical…" />
      <Button
        title="Save advance"
        icon={<HandCoins size={18} color={C.white} />}
        loading={busy}
        disabled={!amount || !employeeId}
        onPress={async () => {
          setBusy(true);
          try {
            const r = await api.action("giveAdvance", { employeeId, amount, recoveryMonths: months, givenOn, startMonth, note });
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
    </Card>
  );
}
