import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { ChevronDown, ChevronRight, HandCoins, IndianRupee, Plus } from "./icons";
import { Badge, Button, Card, Field, H2, Muted, Notice, Row, Segmented } from "./ui";
import { DateField } from "./pickers";
import { GiveAdvanceForm } from "./GiveAdvanceForm";
import { useDialog } from "./dialog";
import { api } from "@/lib/api";
import { dateLabel, monthLabel, rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useUnsavedGuard } from "@/lib/unsaved";

export interface Hisaab {
  since: string;
  upTo: string;
  gross: number;
  pf: number;
  esi: number;
  earned: number;
  extras: number;
  advances: number;
  payments: number;
  balance: number;
  pendingAdvances: number;
  lastPaidOn: string | null;
  months: { month: string; payableDays: number; gross: number; pf: number; esi: number; net: number }[];
  entries: { id: string; kind: "advance" | "payment" | "extra" | "deduction"; date: string; amount: number; note: string | null; mode?: string | null; ref?: string | null; pending?: boolean }[];
}

export interface HisaabCan { pay: boolean; extras: boolean; advance: boolean; owner: boolean }

const MODES = [{ value: "CASH", label: "Cash" }, { value: "BANK", label: "Bank" }, { value: "UPI", label: "UPI" }, { value: "CHEQUE", label: "Cheque" }] as const;
type Mode = (typeof MODES)[number]["value"];
const KIND = {
  advance: { label: "Advance given", sign: "−" },
  payment: { label: "Salary paid", sign: "−" },
  extra: { label: "Extra pay", sign: "+" },
  deduction: { label: "Deduction", sign: "−" },
};

function istToday() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

/** Paise to the plain rupee text used in an amount field, e.g. 1234550 -> "12345.5". */
function rupees(paise: number) {
  return String(Math.round(paise) / 100);
}

/** Pay salary. The amount starts at the full balance, which clears the hisaab. */
function PayForm({ employeeId, name, balance, onDone }: { employeeId: string; name: string; balance: number; onDone: (m: { text: string; ok: boolean }) => Promise<void> }) {
  const dialog = useDialog();
  const [amount, setAmount] = useState(rupees(balance));
  const [paidOn, setPaidOn] = useState(istToday());
  const [mode, setMode] = useState<Mode>("CASH");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useUnsavedGuard(!busy && (amount !== rupees(balance) || !!note));
  const full = Math.round(Number(amount) * 100) === balance;
  return (
    <Card>
      <H2>Pay salary</H2>
      <Muted>Paying the full balance clears the hisaab. You can also pay part; the rest stays as balance.</Muted>
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <DateField label="Paid on" value={paidOn} onChange={setPaidOn} max={istToday()} />
      <Segmented options={MODES.map((m) => ({ value: m.value, label: m.label }))} value={mode} onChange={setMode} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Salary till Diwali" />
      <Button
        title={full ? `Pay ${rs(balance)} and clear` : "Save payment"}
        icon={<IndianRupee size={18} color={C.white} />}
        loading={busy}
        disabled={!(Number(amount) > 0)}
        onPress={async () => {
          if (!(await dialog.confirm({ title: `Pay ₹${amount} to ${name}?`, message: full ? "The hisaab will be clear after this." : `Balance left after this: ${rs(balance - Math.round(Number(amount) * 100))}.`, confirmText: "Save payment" }))) return;
          setBusy(true);
          try {
            const r = await api.action("paySalary", { employeeId, amount, paidOn, mode, note, clear: full ? "1" : "" });
            setNote("");
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

/** Extra pay (bonus, overtime) or a deduction (damage, fine). */
function ExtraForm({ employeeId, onDone }: { employeeId: string; onDone: (m: { text: string; ok: boolean }) => Promise<void> }) {
  const [kind, setKind] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(istToday());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useUnsavedGuard(!busy && (!!amount || !!reason));
  return (
    <Card>
      <H2>Extra pay or deduction</H2>
      <Segmented options={[{ value: "add", label: "Extra pay" }, { value: "deduct", label: "Deduction" }]} value={kind} onChange={setKind} />
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <DateField label="Date" value={date} onChange={setDate} max={istToday()} />
      <Field label="Reason" value={reason} onChangeText={setReason} placeholder={kind === "add" ? "e.g. Diwali bonus" : "e.g. broken tool"} />
      <Button
        title="Save"
        variant="secondary"
        icon={<Plus size={18} color={C.text} />}
        loading={busy}
        disabled={!(Number(amount) > 0) || reason.trim().length < 3}
        onPress={async () => {
          setBusy(true);
          try {
            const r = await api.action("addAdjustment", { employeeId, kind, amount, date, reason });
            setAmount("");
            setReason("");
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

/**
 * One running salary balance for an employee (no salary months):
 * earned since joining + extra pay − deductions − advances − salary paid.
 */
export function HisaabSection({
  employee,
  h,
  wages,
  can,
  onDone,
}: {
  employee: { id: string; name: string; active: boolean };
  h: Hisaab;
  wages: { from: string; wageType: "MONTHLY" | "DAILY"; wage: number }[];
  can: HisaabCan;
  onDone: (m: { text: string; ok: boolean }) => Promise<void>;
}) {
  const dialog = useDialog();
  const [form, setForm] = useState<"pay" | "advance" | "extra" | null>(null);
  const [showMonths, setShowMonths] = useState(false);
  const done = async (m: { text: string; ok: boolean }) => {
    if (m.ok) setForm(null);
    await onDone(m);
  };
  return (
    <>
      <Card>
        <Muted>{h.balance >= 0 ? "Balance to pay" : "Employee owes"}</Muted>
        <Text style={{ fontSize: 30, fontWeight: "700", color: h.balance < 0 ? C.red : C.text, letterSpacing: -0.6 }}>{rs(Math.abs(h.balance))}</Text>
        {h.balance === 0 ? <Badge label="Hisaab clear" tone="green" /> : null}
        {h.balance < 0 ? <Muted>Advance is more than the salary earned. It comes off future salary by itself.</Muted> : null}
        <Row label={`Salary earned since ${dateLabel(h.since)}`} value={rs(h.gross)} />
        {h.pf + h.esi > 0 ? <Row label="PF and ESIC" value={`− ${rs(h.pf + h.esi)}`} /> : null}
        {h.extras !== 0 ? <Row label={h.extras > 0 ? "Extra pay − deductions" : "Deductions − extra pay"} value={`${h.extras > 0 ? "+" : "−"} ${rs(Math.abs(h.extras))}`} /> : null}
        <Row label="Advances given" value={`− ${rs(h.advances)}`} />
        <Row label="Salary paid" value={`− ${rs(h.payments)}`} />
        <Row label="Balance" value={`${h.balance < 0 ? "− " : ""}${rs(Math.abs(h.balance))}`} strong />
        {h.lastPaidOn ? <Muted>Last paid {dateLabel(h.lastPaidOn)}</Muted> : null}
        {h.pendingAdvances > 0 ? <Notice text={`${rs(h.pendingAdvances)} advance is waiting for approval and is not counted yet.`} /> : null}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {can.pay && h.balance > 0 ? <View style={{ flexGrow: 1 }}><Button title="Pay salary" icon={<IndianRupee size={18} color={form === "pay" ? C.text : C.white} />} variant={form === "pay" ? "secondary" : "primary"} onPress={() => setForm(form === "pay" ? null : "pay")} /></View> : null}
          {can.advance && employee.active ? <View style={{ flexGrow: 1 }}><Button title="Give advance" variant="secondary" icon={<HandCoins size={18} color={C.text} />} onPress={() => setForm(form === "advance" ? null : "advance")} /></View> : null}
          {can.extras ? <View style={{ flexGrow: 1 }}><Button title="Extra / deduction" variant="secondary" icon={<Plus size={18} color={C.text} />} onPress={() => setForm(form === "extra" ? null : "extra")} /></View> : null}
        </View>
      </Card>

      {form === "pay" ? <PayForm employeeId={employee.id} name={employee.name} balance={h.balance} onDone={done} /> : null}
      {form === "advance" ? <GiveAdvanceForm employeeId={employee.id} onDone={done} /> : null}
      {form === "extra" ? <ExtraForm employeeId={employee.id} onDone={done} /> : null}

      <Card style={{ gap: 0 }}>
        <H2>Money given and taken</H2>
        {h.entries.length === 0 ? <Muted style={{ marginTop: 6 }}>No advances, payments or extras yet.</Muted> : null}
        {h.entries.map((x, i) => {
          const k = KIND[x.kind];
          const removable = can.owner && x.kind !== "advance";
          return (
            <View key={`${x.kind}-${x.id}`} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, marginTop: i ? 0 : 8, gap: 2, opacity: x.pending ? 0.6 : 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <Text style={{ fontWeight: "600", color: C.text, flex: 1 }}>{k.label}{x.pending ? " · waiting for approval" : ""}</Text>
                <Text style={{ fontWeight: "700", color: x.kind === "extra" ? C.green : x.kind === "deduction" ? C.red : C.text }}>{k.sign} {rs(x.amount)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <Muted style={{ flex: 1 }}>{[dateLabel(x.date), x.mode ? x.mode.toLowerCase() : null, x.ref, x.note].filter(Boolean).join(" · ")}</Muted>
                {removable ? (
                  <Pressable
                    hitSlop={8}
                    accessibilityLabel={`Remove ${k.label}`}
                    onPress={async () => {
                      if (!(await dialog.confirm({ title: `Remove this ${k.label.toLowerCase()}?`, message: `${rs(x.amount)} on ${dateLabel(x.date)}. The balance changes back.`, confirmText: "Remove", danger: true }))) return;
                      try {
                        const r = await api.action(x.kind === "payment" ? "voidPayment" : "removeAdjustment", x.kind === "payment" ? { paymentId: x.id } : { adjustmentId: x.id });
                        await onDone({ text: r.message ?? "Removed", ok: true });
                      } catch (e) {
                        await onDone({ text: (e as Error).message, ok: false });
                      }
                    }}
                  >
                    <Text style={{ color: C.red, fontWeight: "600", fontSize: 13 }}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>

      <Card style={{ gap: 0 }}>
        <Pressable onPress={() => setShowMonths((v) => !v)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }} accessibilityRole="button">
          <H2>How salary earned is worked out</H2>
          {showMonths ? <ChevronDown size={18} color={C.muted} /> : <ChevronRight size={18} color={C.muted} />}
        </Pressable>
        {showMonths ? (
          <View style={{ gap: 6, marginTop: 8 }}>
            <Muted>Every day since joining counts at that day&apos;s salary. A month&apos;s salary is split over that month&apos;s days, so a full month gives the full salary. Present and paid leave count fully, half day half, absent and unpaid leave nothing. Weekly offs and holidays are paid to monthly staff. Edit attendance on any date and this updates by itself.</Muted>
            {wages.length ? <Muted>{wages.map((w) => `From ${dateLabel(w.from)}: ${rs(w.wage)} ${w.wageType === "MONTHLY" ? "/ month" : "/ day"}`).join("\n")}</Muted> : null}
            {h.months.map((m) => (
              <Row key={m.month} label={`${monthLabel(m.month)} · ${m.payableDays} days`} value={rs(m.net)} />
            ))}
            {h.months.length === 0 ? <Muted>Nothing earned yet.</Muted> : null}
          </View>
        ) : null}
      </Card>
    </>
  );
}
