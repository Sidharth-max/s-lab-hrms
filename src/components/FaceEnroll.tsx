"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { enrollFace } from "@/app/actions/employees";
import { Camera, type CameraHandle } from "./Camera";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CircleCheckFilled, ScanFace, type IconType } from "./icons";

// Guided, direction-aware face scan (same rules as the app). Each frame goes to the server's face
// guide (src/lib/face/guide.ts), which checks the face is alone, close enough, centred, level, and
// turned the way the step asks. A photo is kept only after two such frames in a row that barely
// differ (stable), so a face that drifts to the side is never saved.
const STEPS: { key: string; text: string; Icon: IconType }[] = [
  { key: "straight", text: "Look straight at the camera", Icon: ScanFace },
  { key: "side1", text: "Slowly turn your head to the left", Icon: ArrowLeft },
  { key: "side2", text: "Now turn your head to the right", Icon: ArrowRight },
  { key: "vert1", text: "Look up a little", Icon: ArrowUp },
  { key: "vert2", text: "Look down a little", Icon: ArrowDown },
];
const MAX_TRIES = 40; // about 20 s per step

type Reading = { yaw: number; pitch: number; box: { left: number; top: number; width: number; height: number } };
function stable(a: Reading, b: Reading) {
  const ca = [a.box.left + a.box.width / 2, a.box.top + a.box.height / 2];
  const cb = [b.box.left + b.box.width / 2, b.box.top + b.box.height / 2];
  return Math.abs(a.yaw - b.yaw) < 6 && Math.abs(a.pitch - b.pitch) < 6 && Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) < 0.05;
}

export function FaceEnroll({ employeeId, enrolled }: { employeeId: string; enrolled: boolean }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cam = useRef<CameraHandle>(null);
  const run = useRef(0);
  const [state, action, pending] = useActionState(enrollFace, null);
  useEffect(() => () => { run.current += 1; }, []);

  async function scan() {
    const me = ++run.current;
    setPhase("scanning");
    setPhotos([]);
    setError(null);
    const kept: string[] = [];
    const signs: Record<string, number> = {};
    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      setHint(null);
      let accepted = false;
      let prev: Reading | null = null;
      for (let t = 0; t < MAX_TRIES && !accepted; t++) {
        await new Promise((r) => setTimeout(r, t === 0 ? 900 : 350));
        if (run.current !== me) return;
        const image = cam.current?.capture();
        if (!image) continue;
        const s = STEPS[i].key;
        try {
          const res = await fetch("/api/m/face/pose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, step: s, ref: s === "side2" ? signs.side1 : s === "vert2" ? signs.vert1 : 0 }) });
          const r = (await res.json()) as { accept?: boolean; verified?: boolean; hint?: string; sign?: number; error?: string; face?: Reading | null };
          if (run.current !== me) return;
          // Not verified = the server cannot read faces (test mode): keep the frame as before.
          const ok = r.accept && (r.verified === false || (r.face && prev && stable(prev, r.face)));
          if (ok) {
            if (r.sign) signs[s] = r.sign;
            kept.push(image);
            setPhotos([...kept]);
            accepted = true;
          } else if (r.accept && r.face) {
            prev = r.face;
            setHint("Hold still…");
          } else {
            prev = null;
            setHint(r.hint ?? r.error ?? "Adjust your position");
          }
        } catch {
          setHint("No connection. Trying again…");
        }
      }
      if (!accepted && i === 0) {
        setPhase("idle");
        setError("Could not see the face clearly. Use good light, remove cap, mask or dark glasses, and start again.");
        return;
      }
    }
    setPhase("done");
  }

  function close() {
    run.current += 1;
    setOpen(false);
    setPhase("idle");
    setPhotos([]);
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          {enrolled ? "Scan face again" : "Enroll face"}
        </button>
        {state?.ok && <span className="text-sm text-[var(--green)]">{state.message}</span>}
      </div>
    );
  }

  const Current = STEPS[step];
  return (
    <form
      action={async (f) => {
        await action(f);
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={employeeId} />
      {photos.map((p, i) => <input key={i} type="hidden" name="image" value={p} />)}
      {phase !== "done" ? (
        <>
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl">
            <Camera ref={cam} className="aspect-[3/4] w-full" />
            {phase === "scanning" && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-black/55 p-4 text-center text-white" aria-live="polite">
                <Current.Icon size={40} stroke={2.4} aria-hidden />
                <p className="text-lg font-semibold">{Current.text}</p>
                {hint && <p className="text-sm text-white/80">{hint}</p>}
              </div>
            )}
          </div>
          <div className="mx-auto flex w-full max-w-sm gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <span key={s.key} className={`h-1.5 flex-1 rounded-full ${phase === "scanning" && i < step ? "bg-[var(--green)]" : phase === "scanning" && i === step ? "bg-[var(--text)]" : "bg-[var(--line)]"}`} />
            ))}
          </div>
          {phase === "idle" && <p className="muted text-center">Sit at face height in good light. Follow the arrows: the pictures are taken automatically.</p>}
          <div className="flex flex-wrap justify-center gap-2">
            {phase === "idle" ? (
              <button type="button" className="btn-primary" onClick={() => void scan()}>Start face scan</button>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => { run.current += 1; setPhase("idle"); setPhotos([]); }}>Stop</button>
            )}
            <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-1 py-2 text-center">
            <CircleCheckFilled size={48} className="text-[var(--green)]" aria-hidden />
            <p className="font-semibold">Scan complete</p>
            <p className="muted">{photos.length} of {STEPS.length} angles captured</p>
          </div>
          <div className="flex justify-center gap-2">
            {photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p} alt={`Face angle ${i + 1}`} className="aspect-[3/4] w-14 -scale-x-100 rounded-xl object-cover" />
            ))}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consent" className="mt-1 h-5 w-5" required />
            {"The employee was told that their face is used only to mark attendance, and that a manager can mark attendance for them instead if they prefer."}
          </label>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save face"}</button>
            <button type="button" className="btn-secondary" onClick={() => void scan()}>Scan again</button>
            <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          </div>
        </>
      )}
      {error && <p className="notice-red text-center">{error}</p>}
      {state?.error && <p className="text-center text-sm text-[var(--red)]">{state.error}</p>}
      {state?.ok && <p className="text-center text-sm text-[var(--green)]">{state.message}</p>}
    </form>
  );
}
