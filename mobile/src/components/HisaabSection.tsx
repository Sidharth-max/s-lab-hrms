import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { ArrowDownLeft, ArrowUpRight, Cash, ChevronDown, ChevronRight, Coins, Minus, Plus, type IconType } from "./icons";
import { Badge, Button, Card, Field, H2, Muted, Notice, Row, Segmented } from "./ui";
import { DateField } from "./pickers";
import { GiveAdvanceForm } from "./GiveAdvanceForm";
import { Sheet } from "./Sheet";
import { useDialog } from "./dialog";
import { api } from "@/lib/api";
import { dateLabel, monthLabel, rs } from "@/lib/format";
import { C, shadow, type Ink } from "@/lib/theme";
import { useUnsavedGuard } from "@/lib/unsaved";
import { Animated, CountUp, enterAt, PressScale } from "@/lib/motion";

// The salary ledger of one employee (was called "Hisaab" on screen; renamed "Ledger").
// One running balance, no salary months:
//   earned since joining + extra pay − deductions − advances given − salary paid = balance.

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
  /** Bank / cash split (older servers do not send these). bankBalance + cashBalance = balance. */
  bankGross?: number;
  cashGross?: number;
  bankBalance?: number;
  cashBalance?: number;
  pendingAdvances: number;
  lastPaidOn: string | null;
  months: { month: string; payableDays: number; gross: number; pf: number; esi: number; net: number }[];
  entries: { id: string; kind: "advance" | "payment" | "extra" | "deduction"; date: string; amount: number; note: string | null; mode?: string | null; ref?: string | null; pending?: boolean }[];
}

export interface HisaabCan { pay: boolean; extras: boolean; advance: boolean; owner: boolean }

const MODES = [{ value: "CASH", label: "Cash" }, { value: "BANK", label: "Bank" }, { value: "UPI", label: "UPI" }, { value: "CHEQUE", label: "Cheque" }] as const;
type Mode = (typeof MODES)[number]["value"];

/** Colour (text ink) and words for each kind of money movement. Same inks on the website. */
const KIND: Record<Hisaab["entries"][number]["kind"], { label: string; sign: string; ink: Ink; icon: IconType }> = {
  advance: { label: "Advance given", sign: "−", ink: "orange", icon: ArrowDownLeft },
  payment: { label: "Salary paid", sign: "−", ink: "blue", icon: ArrowUpRight },
  extra: { label: "Extra pay", sign: "+", ink: "pink", icon: Plus },
  deduction: { label: "Deduction", sign: "−", ink: "red", icon: Minus },
};

function istToday() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

/** Paise to the plain rupee text used in an amount field, e.g. 1234550 -> "12345.5". */
function rupees(paise: number) {
  return String(Math.round(paise) / 100);
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

/**
 * Pay salary, as a bottom sheet. The amount starts at the full balance, which clears the ledger.
 * The button says exactly what happens ("Pay ₹12,400 to Ramesh") instead of a generic "Pay salary".
 */
export function PaySheet({ visible, employeeId, name, balance, split, onClose, onDone }: { visible: boolean; employeeId: string; name: string; balance: number; /** Bank and cash still to pay: choosing Cash fills the cash amount, Bank / UPI / Cheque the bank amount. */ split?: { bank: number; cash: number }; onClose: () => void; onDone: (m: { text: string; ok: boolean }) => Promise<void> }) {
  const dialog = useDialog();
  const startBank = !!split && split.bank > 0;
  const forMode = (m: string) => (split ? Math.max(0, Math.min(m === "CASH" ? split.cash : split.bank, balance)) : balance);
  const [amount, setAmount] = useState(rupees(split ? forMode(startBank ? "BANK" : "CASH") : balance));
  const [paidOn, setPaidOn] = useState(istToday());
  const [mode, setMode] = useState<Mode>(startBank ? "BANK" : "CASH");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const paise = Math.round(Number(amount) * 100);
  const full = paise === balance;
  const left = balance - paise;
  const who = firstName(name);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Pay ${who}`}
      footer={
        <Button
          title={paise > 0 ? `Pay ${rs(paise)} to ${who}` : "Enter an amount"}
          icon={<Cash size={19} color="#ffffff" />}
          loading={busy}
          disabled={!(paise > 0)}
          onPress={async () => {
            const modeLabel = MODES.find((m) => m.value === mode)?.label.toLowerCase();
            if (!(await dialog.confirm({ title: `Pay ${rs(paise)} to ${name}?`, message: `By ${modeLabel} on ${dateLabel(paidOn)}. ${full ? "Their ledger will be clear after this." : left > 0 ? `${rs(left)} stays due.` : `This is ${rs(-left)} more than due; it is kept as an advance.`}`, confirmText: `Pay ${rs(paise)}` }))) return;
            setBusy(true);
            try {
              const r = await api.action("paySalary", { employeeId, amount, paidOn, mode, note, clear: full ? "1" : "" });
              await onDone({ text: r.message ?? `Paid ${rs(paise)} to ${name}`, ok: true });
            } catch (e) {
              await onDone({ text: (e as Error).message, ok: false });
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <View style={{ backgroundColor: C.tint.green, borderRadius: 18, padding: 14, gap: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: C.ink.green }}>Due to {who}</Text>
        <Text style={{ fontSize: 26, fontWeight: "700", color: C.ink.green, fontVariant: ["tabular-nums"] }}>{rs(balance)}</Text>
      </View>
      <Field label="Amount to pay now (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" hint={full ? "Full amount: clears the ledger." : paise > 0 && left > 0 ? `${rs(left)} will stay due.` : undefined} />
      <Segmented options={MODES.map((m) => ({ value: m.value, label: m.label }))} value={mode} onChange={(m) => { setMode(m); if (split) setAmount(rupees(forMode(m))); }} />
      {split ? <Muted>{`Bank to pay ${rs(Math.max(0, split.bank))} · Cash to pay ${rs(Math.max(0, split.cash))}`}</Muted> : null}
      <DateField label="Paid on" value={paidOn} onChange={setPaidOn} max={istToday()} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Salary till Diwali" />
    </Sheet>
  );
}

/** Extra pay (bonus, overtime) or a deduction (damage, fine), as a bottom sheet. */
function ExtraSheet({ visible, employeeId, onClose, onDone }: { visible: boolean; employeeId: string; onClose: () => void; onDone: (m: { text: string; ok: boolean }) => Promise<void> }) {
  const [kind, setKind] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(istToday());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useUnsavedGuard(visible && !busy && (!!amount || !!reason));
  const n = Math.round(Number(amount) * 100);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Extra pay or deduction"
      footer={
        <Button
          title={n > 0 ? (kind === "add" ? `Add ${rs(n)} extra pay` : `Deduct ${rs(n)}`) : "Save"}
          variant={kind === "add" ? "primary" : "danger"}
          loading={busy}
          disabled={!(n > 0) || reason.trim().length < 3}
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
      }
    >
      <Segmented options={[{ value: "add", label: "Extra pay" }, { value: "deduct", label: "Deduction" }]} value={kind} onChange={setKind} />
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <DateField label="Date" value={date} onChange={setDate} max={istToday()} />
      <Field label="Reason" value={reason} onChangeText={setReason} placeholder={kind === "add" ? "e.g. Diwali bonus" : "e.g. broken tool"} />
    </Sheet>
  );
}

export type LedgerForm = "pay" | "advance" | "extra" | null;

/** Pay / advance / extra buttons. Rendered in a bar at the bottom of the screen (thumb zone). */
export function LedgerActions({ h, can, active, name, onOpen }: { h: Hisaab; can: HisaabCan; active: boolean; name: string; onOpen: (f: LedgerForm) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {can.pay && h.balance > 0 ? (
        <View style={{ flex: 1.4 }}>
          <Button title={`Pay ${rs(h.balance)}`} accessibilityLabel={`Pay ${rs(h.balance)} to ${name}`} icon={<Cash size={18} color="#ffffff" />} onPress={() => onOpen("pay")} />
        </View>
      ) : null}
      {can.advance && active ? (
        <View style={{ flex: 1 }}>
          <Button title="Advance" variant="secondary" icon={<Coins size={18} color={C.ink.orange} />} onPress={() => onOpen("advance")} />
        </View>
      ) : null}
      {can.extras ? (
        <PressScale onPress={() => onOpen("extra")} accessibilityRole="button" accessibilityLabel="Extra pay or deduction" style={{ width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
          <Plus size={20} color={C.ink.pink} />
        </PressScale>
      ) : null}
    </View>
  );
}

/** The sheets opened by LedgerActions. */
export function LedgerSheets({ employee, h, form, setForm, onDone }: { employee: { id: string; name: string }; h: Hisaab; form: LedgerForm; setForm: (f: LedgerForm) => void; onDone: (m: { text: string; ok: boolean }) => Promise<void> }) {
  const done = async (m: { text: string; ok: boolean }) => {
    if (m.ok) setForm(null);
    await onDone(m);
  };
  return (
    <>
      {form === "pay" ? <PaySheet visible employeeId={employee.id} name={employee.name} balance={h.balance} split={h.cashGross ? { bank: h.bankBalance ?? 0, cash: h.cashBalance ?? 0 } : undefined} onClose={() => setForm(null)} onDone={done} /> : null}
      {form === "advance" ? (
        <Sheet visible onClose={() => setForm(null)} title={`Give advance to ${firstName(employee.name)}`}>
          <GiveAdvanceForm bare employeeId={employee.id} onDone={done} />
        </Sheet>
      ) : null}
      {form === "extra" ? <ExtraSheet visible employeeId={employee.id} onClose={() => setForm(null)} onDone={done} /> : null}
    </>
  );
}

export function HisaabSection({ h, wages, can, onDone }: { employee: { id: string; name: string; active: boolean }; h: Hisaab; wages: { from: string; wageType: "MONTHLY" | "DAILY"; wage: number }[]; can: HisaabCan; onDone: (m: { text: string; ok: boolean }) => Promise<void> }) {
  const dialog = useDialog();
  const [showMonths, setShowMonths] = useState(false);
  const owes = h.balance < 0;
  return (
    <>
      <Card style={{ gap: 6, ...shadow(2) }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: owes ? C.ink.red : C.ink.green }}>{owes ? "Employee owes you" : h.balance === 0 ? "Ledger" : "To pay now"}</Text>
        <CountUp value={Math.abs(h.balance)} format={(n) => rs(Math.round(n))} style={{ fontSize: 34, fontWeight: "700", color: owes ? C.ink.red : h.balance === 0 ? C.text : C.ink.green, letterSpacing: -1 }} />
        {h.balance === 0 ? <Badge label="All settled" tone="green" dot /> : null}
        {owes ? <Muted>Advance is more than the salary earned. It comes off future salary by itself.</Muted> : null}
        {h.cashGross ? (
          // Two parts: PF / ESIC come off the bank part; advances and extras sit on the cash part.
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <View style={{ flex: 1, backgroundColor: C.tint.blue, borderRadius: 14, padding: 10, gap: 2 }}>
              <Text style={{ color: C.ink.blue, fontSize: 12, fontWeight: "600" }}>Bank to pay</Text>
              <Text style={{ color: (h.bankBalance ?? 0) < 0 ? C.ink.red : C.ink.blue, fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{(h.bankBalance ?? 0) < 0 ? "− " : ""}{rs(Math.abs(h.bankBalance ?? 0))}</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>after PF / ESIC</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.tint.orange, borderRadius: 14, padding: 10, gap: 2 }}>
              <Text style={{ color: C.ink.orange, fontSize: 12, fontWeight: "600" }}>Cash to pay</Text>
              <Text style={{ color: (h.cashBalance ?? 0) < 0 ? C.ink.red : C.ink.orange, fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{(h.cashBalance ?? 0) < 0 ? "− " : ""}{rs(Math.abs(h.cashBalance ?? 0))}</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>after advances</Text>
            </View>
          </View>
        ) : null}
        <View style={{ height: 1, backgroundColor: C.hairline, marginVertical: 6 }} />
        <Row label={`Earned since ${dateLabel(h.since)}`} value={`+ ${rs(h.gross)}`} ink="violet" />
        {h.pf + h.esi > 0 ? <Row label="PF and ESIC" value={`− ${rs(h.pf + h.esi)}`} ink="red" /> : null}
        {h.extras !== 0 ? <Row label={h.extras > 0 ? "Extra pay − deductions" : "Deductions − extra pay"} value={`${h.extras > 0 ? "+" : "−"} ${rs(Math.abs(h.extras))}`} ink={h.extras > 0 ? "pink" : "red"} /> : null}
        <Row label="Advance given" value={`− ${rs(h.advances)}`} ink="orange" />
        <Row label="Salary paid" value={`− ${rs(h.payments)}`} ink="blue" />
        <Row label="Balance" value={<Text style={{ fontSize: 16, fontWeight: "700", color: owes ? C.ink.red : C.ink.green, fontVariant: ["tabular-nums"] }}>{owes ? "− " : ""}{rs(Math.abs(h.balance))}</Text>} />
        {h.lastPaidOn ? <Muted>Last paid {dateLabel(h.lastPaidOn)}</Muted> : null}
        {h.pendingAdvances > 0 ? <Notice text={`${rs(h.pendingAdvances)} advance is waiting for approval and is not counted yet.`} /> : null}
      </Card>

      <Card style={{ gap: 0 }}>
        <H2>Money in and out</H2>
        {h.entries.length === 0 ? <Muted style={{ marginTop: 6 }}>No advances, payments or extras yet.</Muted> : null}
        {h.entries.map((x, i) => {
          const k = KIND[x.kind];
          const removable = can.owner && x.kind !== "advance";
          return (
            <Animated.View key={`${x.kind}-${x.id}`} entering={enterAt(i)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: C.hairline, marginTop: i ? 0 : 8, opacity: x.pending ? 0.6 : 1 }}>
              <View style={{ width: 36, height: 36, borderRadius: 13, backgroundColor: C.tint[k.ink], alignItems: "center", justifyContent: "center" }}>
                <k.icon size={18} color={C.ink[k.ink]} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontWeight: "600", color: C.ink[k.ink], fontSize: 15 }}>{k.label}{x.pending ? " · waiting for approval" : ""}</Text>
                <Muted style={{ fontSize: 13 }}>{[dateLabel(x.date), x.mode ? x.mode.toLowerCase() : null, x.ref, x.note].filter(Boolean).join(" · ")}</Muted>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={{ fontWeight: "700", color: C.ink[k.ink], fontVariant: ["tabular-nums"] }}>{k.sign} {rs(x.amount)}</Text>
                {removable ? (
                  <Pressable
                    hitSlop={10}
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
                    <Text style={{ color: C.muted, fontWeight: "600", fontSize: 12, textDecorationLine: "underline" }}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </Animated.View>
          );
        })}
      </Card>

      <Card style={{ gap: 0 }}>
        <Pressable onPress={() => setShowMonths((v) => !v)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }} accessibilityRole="button" accessibilityState={{ expanded: showMonths }}>
          <H2>How earnings are worked out</H2>
          {showMonths ? <ChevronDown size={18} color={C.muted} /> : <ChevronRight size={18} color={C.muted} />}
        </Pressable>
        {showMonths ? (
          <View style={{ gap: 6, marginTop: 8 }}>
            <Muted>Every day since joining counts at that day&apos;s salary. A month&apos;s salary is split over that month&apos;s days, so a full month gives the full salary. Present and paid leave count fully, half day half, absent and unpaid leave nothing. Weekly offs and holidays are paid to monthly staff. Edit attendance on any date and this updates by itself.</Muted>
            {wages.length ? <Muted>{wages.map((w) => `From ${dateLabel(w.from)}: ${rs(w.wage)} ${w.wageType === "MONTHLY" ? "/ month" : "/ day"}`).join("\n")}</Muted> : null}
            {h.months.map((m) => <Row key={m.month} label={`${monthLabel(m.month)} · ${m.payableDays} days`} value={rs(m.net)} ink="violet" />)}
            {h.months.length === 0 ? <Muted>Nothing earned yet.</Muted> : null}
          </View>
        ) : null}
      </Card>
    </>
  );
}
