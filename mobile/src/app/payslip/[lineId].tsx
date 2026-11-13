import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/Text";
import { Share2 } from "@/components/icons";
import { Badge, Button, Card, ErrorView, Loading, Muted, Notice, Row, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { monthLabel, rs } from "@/lib/format";
import { C } from "@/lib/theme";
import { useLoad } from "@/lib/useLoad";

interface Slip {
  business: string; month: string; locked: boolean; employee: { name: string; code: string; site: string; uanNumber?: string | null; esicNumber?: string | null };
  wageType: "MONTHLY" | "DAILY"; rate: number; daysInMonth: number; presentDays: number; payableDays: number;
  gross: number; adjustments: number; pf: number; esi: number; pfEmployer: number; esiEmployer: number; advance: number; net: number;
  paid: number; paidOn: string | null; paymentMode: string | null; paymentRef: string | null;
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function lines(p: Slip) {
  const earnings: [string, number][] = [
    [p.wageType === "MONTHLY" ? `Salary (${p.payableDays} of ${p.daysInMonth} days)` : `Wages (${p.payableDays} days x ${rs(p.rate)})`, p.gross],
    ...(p.adjustments > 0 ? [["Extra payment", p.adjustments] as [string, number]] : []),
  ];
  const deductions = (
    [
      ["PF (employee)", p.pf],
      ["ESIC (employee)", p.esi],
      ["Advance recovered", p.advance],
      ...(p.adjustments < 0 ? [["Other deduction", -p.adjustments] as [string, number]] : []),
    ] as [string, number][]
  ).filter(([, v]) => v > 0);
  return { earnings, deductions };
}

/** Printable payslip for the PDF. */
function html(p: Slip) {
  const { earnings, deductions } = lines(p);
  const rows = (list: [string, number][]) =>
    list.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${esc(rs(v))}</td></tr>`).join("") || `<tr><td colspan="2">None</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,sans-serif;color:#171717;padding:24px}
    h1{font-size:20px;margin:0}.m{color:#666;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:12px}
    td,th{border-bottom:1px solid #e5e5e5;padding:8px 4px;font-size:13px;text-align:left}.r{text-align:right}
    .net{display:flex;justify-content:space-between;background:#f4f4f4;padding:12px;margin-top:16px;font-weight:700;font-size:16px}
  </style></head><body>
    <h1>${esc(p.business)}</h1><div class="m">Payslip · ${esc(monthLabel(p.month))}${p.locked ? "" : " · DRAFT"}</div>
    <table><tr><td>Name</td><td>${esc(p.employee.name)}</td></tr><tr><td>Code</td><td>${esc(p.employee.code)}</td></tr>
    <tr><td>Site</td><td>${esc(p.employee.site)}</td></tr>${p.employee.uanNumber ? `<tr><td>PF UAN</td><td>${esc(p.employee.uanNumber)}</td></tr>` : ""}${p.employee.esicNumber ? `<tr><td>ESIC IP</td><td>${esc(p.employee.esicNumber)}</td></tr>` : ""}<tr><td>Days present</td><td>${p.presentDays}</td></tr><tr><td>Payable days</td><td>${p.payableDays}</td></tr></table>
    <table><tr><th>Earnings</th><th class="r">Amount</th></tr>${rows(earnings)}</table>
    <table><tr><th>Deductions</th><th class="r">Amount</th></tr>${rows(deductions)}</table>
    <div class="net"><span>Net pay</span><span>${esc(rs(p.net))}</span></div>
    ${p.pfEmployer || p.esiEmployer ? `<p class="m">Employer contribution (not deducted): PF ${esc(rs(p.pfEmployer))}, ESIC ${esc(rs(p.esiEmployer))}</p>` : ""}
    ${p.paid ? `<p class="m">Paid ${esc(rs(p.paid))} · ${esc(p.paymentMode ?? "")} · ${esc(p.paidOn ?? "")}${p.paymentRef ? ` (ref ${esc(p.paymentRef)})` : ""}</p>` : ""}
  </body></html>`;
}

export default function PayslipScreen() {
  const { lineId } = useLocalSearchParams<{ lineId: string }>();
  const { data, error, reload } = useLoad(() => api.get<Slip>(`/api/m/payslip/${lineId}`), [lineId], ["payroll"]);
  const [busy, setBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  if (!data && error) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { earnings, deductions } = lines(data);
  return (
    <Screen>
      <Stack.Screen options={{ title: `Payslip · ${monthLabel(data.month)}` }} />
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>{data.employee.name}</Text>
          {!data.locked ? <Badge label="Draft" /> : null}
        </View>
        <Muted>{data.employee.code} · {data.employee.site} · {data.business}</Muted>
        {data.employee.uanNumber ? <Row label="PF UAN" value={data.employee.uanNumber} /> : null}
        {data.employee.esicNumber ? <Row label="ESIC IP" value={data.employee.esicNumber} /> : null}
        <Row label="Days present" value={String(data.presentDays)} />
        <Row label="Payable days" value={String(data.payableDays)} />
      </Card>
      <Card>
        <Text style={{ fontWeight: "600", color: C.text }}>Earnings</Text>
        {earnings.map(([k, v]) => <Row key={k} label={k} value={rs(v)} />)}
        <Text style={{ fontWeight: "600", color: C.text, marginTop: 8 }}>Deductions</Text>
        {deductions.length ? deductions.map(([k, v]) => <Row key={k} label={k} value={rs(v)} />) : <Muted>None</Muted>}
        <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
          <Row label="Net pay" value={rs(data.net)} strong />
        </View>
      </Card>
      {data.paid ? <Muted>Paid {rs(data.paid)} · {data.paymentMode} · {data.paidOn}</Muted> : null}
      {shareError ? <Notice tone="red" text={shareError} /> : null}
      <Button
        title="Share as PDF"
        icon={<Share2 size={18} color={C.white} />}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setShareError(null);
          try {
            const { uri } = await Print.printToFileAsync({ html: html(data) });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share payslip" });
            else await Print.printAsync({ uri });
          } catch (e) {
            setShareError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
