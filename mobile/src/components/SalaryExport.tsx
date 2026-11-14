import { useState } from "react";
import { Platform, View } from "react-native";
import { Button, Card, Muted, Notice, SectionHead } from "./ui";
import { DateField } from "./pickers";
import { Download, Share2 } from "./icons";
import { API_URL, tokens } from "@/lib/api";
import { C } from "@/lib/theme";

// Salary statement for a date range (e.g. 1st to 30th) as a PDF or an Excel file: every day's
// attendance (present / absent, clock in / out, late, left early) and the salary breakdown.
// The server builds the file; the app downloads it with the login token, then opens it (or shares it).

const MIME = { pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } as const;
type Format = keyof typeof MIME;

function istToday() {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

export function SalaryExport({ employeeId, joinedOn }: { employeeId: string; joinedOn: string }) {
  const today = istToday();
  const [from, setFrom] = useState(() => (`${today.slice(0, 7)}-01` < joinedOn ? joinedOn : `${today.slice(0, 7)}-01`));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ uri: string; format: Format } | null>(null);

  async function download(format: Format) {
    setBusy(format);
    setError(null);
    try {
      const url = `${API_URL}/api/m/salary-statement?employeeId=${encodeURIComponent(employeeId)}&from=${from}&to=${to}&format=${format}`;
      const token = await tokens.getSession();
      if (Platform.OS === "web") {
        // Browser build (testing only): download through a blob link.
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Download failed (${res.status})`);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(await res.blob());
        a.download = `salary-${from}-to-${to}.${format}`;
        a.click();
        return;
      }
      const FS = await import("expo-file-system/legacy");
      const file = `${FS.cacheDirectory}salary-${employeeId.slice(-6)}-${from}-to-${to}.${format}`;
      await FS.deleteAsync(file, { idempotent: true });
      const res = await FS.downloadAsync(url, file, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status !== 200) {
        const body = await FS.readAsStringAsync(res.uri).catch(() => "");
        let msg = `Download failed (${res.status})`;
        try {
          msg = (JSON.parse(body) as { error?: string }).error ?? msg;
        } catch {}
        throw new Error(msg);
      }
      setLast({ uri: res.uri, format });
      await open(res.uri, format);
    } catch (e) {
      setError((e as Error).message || "Download failed. Check the internet and try again.");
    } finally {
      setBusy(null);
    }
  }

  /** Opens the file in a PDF / spreadsheet app; without one, shows the share sheet instead. */
  async function open(uri: string, format: Format) {
    if (Platform.OS === "android") {
      try {
        const FS = await import("expo-file-system/legacy");
        const IntentLauncher = await import("expo-intent-launcher");
        const content = await FS.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", { data: content, flags: 1, type: MIME[format] });
        return;
      } catch {
        // no app for this file type: fall through to sharing
      }
    }
    await share(uri, format);
  }

  async function share(uri: string, format: Format) {
    const Sharing = await import("expo-sharing");
    if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this phone");
    await Sharing.shareAsync(uri, { mimeType: MIME[format], dialogTitle: "Salary statement", UTI: format === "pdf" ? "com.adobe.pdf" : "org.openxmlformats.spreadsheetml.sheet" });
  }

  const badRange = !from || !to || from > to;
  return (
    <Card>
      <SectionHead icon={<Download size={18} color={C.ink.blue} />} ink="blue" title="Salary statement" />
      <Muted>Each day&apos;s attendance (present, absent, clock in / out, late, left early) and the salary for those days, with advances and payments.</Muted>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><DateField label="From" value={from} onChange={setFrom} min={joinedOn} max={to || undefined} /></View>
        <View style={{ flex: 1 }}><DateField label="To" value={to} onChange={setTo} min={from || joinedOn} /></View>
      </View>
      {badRange ? <Notice tone="red" text="The from date must be on or before the to date." /> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button title="PDF" icon={<Download size={18} color="#ffffff" />} loading={busy === "pdf"} disabled={badRange || !!busy} onPress={() => download("pdf")} /></View>
        <View style={{ flex: 1 }}><Button title="Excel" variant="secondary" icon={<Download size={18} color={C.text} />} loading={busy === "xlsx"} disabled={badRange || !!busy} onPress={() => download("xlsx")} /></View>
      </View>
      {last && Platform.OS !== "web" ? (
        <Button title={`Share the ${last.format === "pdf" ? "PDF" : "Excel file"}`} variant="secondary" icon={<Share2 size={18} color={C.text} />} onPress={() => share(last.uri, last.format).catch((e: Error) => setError(e.message))} />
      ) : null}
      {error ? <Notice tone="red" text={error} /> : null}
    </Card>
  );
}
