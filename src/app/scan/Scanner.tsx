"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, type CameraHandle } from "@/components/Camera";
import { beep, speak } from "@/lib/speak";

const Liveness = dynamic(() => import("./Liveness"), { ssr: false });

interface Config {
  device: { name: string; site: string; business: string };
  mode: "mock" | "aws";
  liveness: boolean;
  language: "hi" | "en";
  region: string;
  testEmployees: { id: string; name: string; code: string }[];
}

type Result = { ok: boolean; title: string; detail?: string };

function Clock({ lang }: { lang: "hi" | "en" }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (!now) return null;
  return (
    <span>
      {now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
      {" · "}
      {now.toLocaleDateString(lang === "en" ? "en-IN" : "hi-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" })}
    </span>
  );
}

export function Scanner() {
  const cam = useRef<CameraHandle>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [picking, setPicking] = useState<string | null>(null); // captured image while choosing in test mode
  const [livenessSession, setLivenessSession] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lang = config?.language ?? "hi";
  const m = useCallback((hi: string, en: string) => (lang === "en" ? en : hi), [lang]);

  useEffect(() => {
    fetch("/api/scan", { cache: "no-store" })
      .then((r) => (r.status === 401 ? (window.location.reload(), null) : r.json()))
      .then((c) => c && setConfig(c))
      .catch(() => setResult({ ok: false, title: "इंटरनेट नहीं है / No internet", detail: "मैनेजर बाद में हाज़िरी लगाएंगे / The manager will enter attendance later" }));
  }, []);

  const show = useCallback((r: Result, speech?: string) => {
    setResult(r);
    beep(r.ok);
    void speak((speech ?? r.title).replace("✓", ""), lang);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setResult(null), 4500);
  }, [lang]);

  const send = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({ ok: false, message: m("फिर से कोशिश करें", "Please try again") }));
        if (data.ok) {
          show({ ok: true, title: data.title, detail: `${data.name} (${data.code}) · ${data.time}` }, data.speech);
        } else {
          show({ ok: false, title: data.message ?? m("फिर से कोशिश करें", "Please try again") });
        }
      } catch {
        show({ ok: false, title: m("इंटरनेट नहीं है", "No internet"), detail: m("मैनेजर से हाज़िरी लगवाएं", "Ask the manager to mark your attendance") });
      } finally {
        setBusy(false);
      }
    },
    [show, m],
  );

  const start = useCallback(async () => {
    if (busy || !config || result || picking || livenessSession) return;
    if (config.liveness) {
      setBusy(true);
      const r = await fetch("/api/liveness/session", { method: "POST" }).then((x) => x.json()).catch(() => null);
      setBusy(false);
      if (!r?.sessionId) return show({ ok: false, title: m("सर्विस में दिक्कत, फिर से कोशिश करें", "Service problem, please try again") });
      setLivenessSession(r.sessionId);
      return;
    }
    const image = cam.current?.capture();
    if (!image) return show({ ok: false, title: m("कैमरा तैयार नहीं है", "Camera not ready") });
    if (config.mode === "mock") return setPicking(image);
    await send({ image });
  }, [busy, config, result, picking, livenessSession, send, show, m]);

  return (
    <main className="fixed inset-0 flex flex-col bg-black text-white select-none">
      <header className="flex items-center justify-between gap-2 bg-black/80 px-4 py-3 text-sm">
        <div>
          <div className="font-semibold">{config?.device.business ?? "…"}</div>
          <div className="text-white/70">{config ? `${config.device.site} · ${config.device.name}` : ""}</div>
        </div>
        <div className="text-right text-white/80"><Clock lang={lang} /></div>
      </header>

      {livenessSession && config ? (
        <div className="flex-1 overflow-auto bg-white text-black">
          <Liveness
            sessionId={livenessSession}
            region={config.region}
            lang={lang}
            onDone={() => {
              const sid = livenessSession;
              setLivenessSession(null);
              void send({ livenessSessionId: sid });
            }}
            onError={() => {
              setLivenessSession(null);
              show({ ok: false, title: m("जाँच पूरी नहीं हुई, फिर से कोशिश करें", "Check not completed, please try again") });
            }}
          />
        </div>
      ) : (
        <button type="button" onClick={start} className="relative flex-1 overflow-hidden" aria-label="Scan face">
          <Camera ref={cam} className="absolute inset-0 h-full w-full" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[55%] aspect-[3/4] rounded-[50%] border-4 border-white/70" />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-6 text-center">
            <div className="text-3xl font-bold">{busy ? m("जाँच हो रही है…", "Checking…") : m("स्क्रीन छुएं और कैमरे की तरफ़ देखें", "Tap the screen and look at the camera")}</div>
            {config?.mode === "mock" && <div className="mt-2 inline-block rounded bg-amber-400 px-2 py-0.5 text-sm font-bold text-black">TEST MODE</div>}
          </div>
        </button>
      )}

      {picking && config && (
        <div className="absolute inset-0 z-10 flex flex-col bg-black/90 p-4">
          <p className="mb-1 text-lg font-bold text-amber-300">TEST MODE: who is in front of the camera?</p>
          <p className="mb-3 text-sm text-white/70">With AWS face recognition switched on, this step is automatic.</p>
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
            {config.testEmployees.length === 0 && <p>No employee has a face enrolled yet.</p>}
            {config.testEmployees.map((e) => (
              <button
                key={e.id}
                className="rounded-lg bg-white/10 p-3 text-left hover:bg-white/20"
                onClick={() => {
                  const img = picking;
                  setPicking(null);
                  void send({ image: img, mockEmployeeId: e.id });
                }}
              >
                <div className="font-semibold">{e.name}</div>
                <div className="text-sm text-white/60">{e.code}</div>
              </button>
            ))}
          </div>
          <button className="btn-secondary mt-3 text-black" onClick={() => setPicking(null)}>Cancel</button>
        </div>
      )}

      {result && (
        <div
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center ${result.ok ? "bg-green-700" : "bg-red-700"}`}
          onClick={() => setResult(null)}
        >
          <div className="text-5xl font-bold">{result.title}</div>
          {result.detail && <div className="mt-4 text-2xl">{result.detail}</div>}
        </div>
      )}

      <footer className="flex justify-end bg-black/80 px-4 py-2">
        <Link href="/login?from=scan" className="text-xs text-white/50 underline">{m("मैनेजर लॉग इन", "Manager login")}</Link>
      </footer>
    </main>
  );
}
