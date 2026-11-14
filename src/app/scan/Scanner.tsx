"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { CircleCheck, CircleX, ScanFace } from "@/components/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, type CameraHandle } from "@/components/Camera";
import { beep, speak } from "@/lib/speak";

const Liveness = dynamic(() => import("./Liveness"), { ssr: false });

interface Config {
  device: { name: string; site: string; business: string };
  mode: "mock" | "aws";
  liveness: boolean;
  region: string;
  testEmployees: { id: string; name: string; code: string }[];
}

type Result = { ok: boolean; title: string; detail?: string };

function Clock() {
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
      {now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" })}
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
  // Waiting screen: a big Scan button with the camera off. Tapping it opens the camera and the face is
  // scanned by itself once the picture is showing; after the result it goes back to the button.
  const [armed, setArmed] = useState(false);
  const [camReady, setCamReady] = useState(false);

  useEffect(() => {
    fetch("/api/scan", { cache: "no-store" })
      .then((r) => (r.status === 401 ? (window.location.reload(), null) : r.json()))
      .then((c) => c && setConfig(c))
      .catch(() => setResult({ ok: false, title: "No internet", detail: "The manager will enter attendance later" }));
  }, []);

  const show = useCallback((r: Result, speech?: string) => {
    setResult(r);
    beep(r.ok);
    void speak(speech ?? r.title);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setResult(null);
      setArmed(false); // back to the Scan button, camera off
      setCamReady(false);
    }, 3500);
  }, []);

  const send = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({ ok: false, message: "Please try again" }));
        if (data.ok) {
          show({ ok: true, title: data.title, detail: `${data.name} (${data.code}) · ${data.time}` }, data.speech);
        } else {
          show({ ok: false, title: data.message ?? "Please try again" });
        }
      } catch {
        show({ ok: false, title: "No internet", detail: "Ask the manager to mark your attendance" });
      } finally {
        setBusy(false);
      }
    },
    [show],
  );

  const start = useCallback(async () => {
    if (busy || !config || result || picking || livenessSession) return;
    if (config.liveness) {
      setBusy(true);
      const r = await fetch("/api/liveness/session", { method: "POST" }).then((x) => x.json()).catch(() => null);
      setBusy(false);
      if (!r?.sessionId) return show({ ok: false, title: "Service problem, please try again" });
      setLivenessSession(r.sessionId);
      return;
    }
    const image = cam.current?.capture();
    if (!image) return show({ ok: false, title: "Camera not ready" });
    if (config.mode === "mock") return setPicking(image);
    await send({ image });
  }, [busy, config, result, picking, livenessSession, send, show]);

  const arm = useCallback(() => {
    if (!config || result || busy || picking || livenessSession) return;
    // With the liveness check the check itself opens the camera.
    if (config.liveness) return void start();
    setCamReady(false);
    setArmed(true);
  }, [config, result, busy, picking, livenessSession, start]);

  // Auto-scan shortly after the camera picture appears (time for focus / exposure).
  useEffect(() => {
    if (!armed || !camReady || busy || result || picking) return;
    const t = setTimeout(() => void start(), 800);
    return () => clearTimeout(t);
  }, [armed, camReady, busy, result, picking, start]);

  // Safety: camera never started -> back to the button.
  useEffect(() => {
    if (!armed || result || picking || busy) return;
    const t = setTimeout(() => { setArmed(false); setCamReady(false); }, 20000);
    return () => clearTimeout(t);
  }, [armed, result, picking, busy]);

  const status = !config ? "Connecting…" : !armed ? "Tap Scan to mark your attendance" : busy ? "Checking…" : camReady ? "Look at the camera…" : "Starting camera…";

  return (
    <main className="fixed inset-0 flex flex-col bg-black text-white select-none">
      <header className="flex items-center justify-between gap-2 bg-black/80 px-4 py-3 text-sm">
        <div>
          <div className="font-semibold">{config?.device.business ?? "…"}</div>
          <div className="text-white/70">{config ? `${config.device.site} · ${config.device.name}` : ""}</div>
        </div>
        <div className="text-right text-white/80"><Clock /></div>
      </header>

      {livenessSession && config ? (
        <div className="flex-1 overflow-auto bg-white text-black">
          <Liveness
            sessionId={livenessSession}
            region={config.region}
            onDone={() => {
              const sid = livenessSession;
              setLivenessSession(null);
              void send({ livenessSessionId: sid });
            }}
            onError={() => {
              setLivenessSession(null);
              show({ ok: false, title: "Check not completed, please try again" });
            }}
          />
        </div>
      ) : (
        // A tappable area (not a <button>): the camera inside has its own front / back switch button.
        <div
          role="button"
          tabIndex={0}
          onClick={armed ? undefined : arm}
          onKeyDown={(e) => { if (!armed && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); arm(); } }}
          className={`relative flex-1 overflow-hidden ${armed ? "" : "cursor-pointer"}`}
          aria-label="Scan face"
        >
          {armed ? (
            <>
              <Camera ref={cam} className="absolute inset-0 h-full w-full" onReady={() => setCamReady(true)} />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[55%] aspect-[3/4] rounded-[50%] border-4 border-white/70" />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="relative flex items-center justify-center">
                <span aria-hidden className="absolute h-[min(62vw,52vh,22rem)] w-[min(62vw,52vh,22rem)] animate-ping rounded-full bg-white/15 [animation-duration:2s]" />
                <span className="relative flex h-[min(55vw,46vh,20rem)] w-[min(55vw,46vh,20rem)] flex-col items-center justify-center gap-2 rounded-full border-4 border-white/85 bg-[#4a3cff] shadow-[0_20px_60px_rgba(74,60,255,0.45)] transition active:scale-95">
                  <ScanFace size={72} aria-hidden />
                  <span className="text-3xl font-bold tracking-tight">Scan</span>
                </span>
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-6 text-center">
            {armed && <ScanFace size={40} className="mx-auto mb-3" aria-hidden />}
            <div className="text-2xl font-semibold tracking-tight">{status}</div>
            {config?.mode === "mock" && <div className="mt-2 inline-block rounded-md border border-white/30 px-2.5 py-0.5 text-xs font-medium text-white">TEST MODE</div>}
          </div>
        </div>
      )}

      {picking && config && (
        <div className="absolute inset-0 z-10 flex flex-col bg-black/90 p-4">
          <p className="mb-1 text-lg font-semibold text-white">TEST MODE: who is in front of the camera?</p>
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
          <button className="btn-secondary mt-3 text-black" onClick={() => { setPicking(null); setArmed(false); setCamReady(false); }}>Cancel</button>
        </div>
      )}

      {result && (
        <div
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center ${result.ok ? "bg-[var(--green)]" : "bg-[var(--red)]"}`}
          onClick={() => setResult(null)}
        >
          {result.ok ? <CircleCheck size={96} aria-hidden /> : <CircleX size={96} aria-hidden />}
          <div className="mt-6 text-4xl font-semibold tracking-tight">{result.title}</div>
          {result.detail && <div className="mt-4 text-2xl">{result.detail}</div>}
        </div>
      )}

      <footer className="flex justify-end bg-black/80 px-4 py-2">
        <Link href="/login?from=scan" className="text-xs text-white/50 underline">Manager login</Link>
      </footer>
    </main>
  );
}
