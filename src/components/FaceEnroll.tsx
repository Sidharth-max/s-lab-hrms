"use client";

import { useActionState, useRef, useState } from "react";
import { enrollFace } from "@/app/actions/employees";
import { Camera, type CameraHandle } from "./Camera";

export function FaceEnroll({ employeeId, enrolled }: { employeeId: string; enrolled: boolean }) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const cam = useRef<CameraHandle>(null);
  const [state, action, pending] = useActionState(enrollFace, null);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          {enrolled ? "Re-take face photo" : "Enroll face"}
        </button>
        {state?.ok && <span className="text-sm text-green-700">{state.message}</span>}
      </div>
    );
  }

  return (
    <form
      action={async (f) => {
        await action(f);
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={employeeId} />
      <input type="hidden" name="image" value={photo ?? ""} />
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Captured face" className="aspect-[3/4] w-full -scale-x-100 object-cover" />
        ) : (
          <Camera ref={cam} className="aspect-[3/4] w-full" />
        )}
      </div>
      <p className="muted text-center">Face straight, good light, no cap, mask or dark glasses.</p>
      <div className="flex flex-wrap justify-center gap-2">
        {photo ? (
          <button type="button" className="btn-secondary" onClick={() => setPhoto(null)}>Retake</button>
        ) : (
          <button type="button" className="btn-primary" onClick={() => setPhoto(cam.current?.capture() ?? null)}>Take photo</button>
        )}
        <button type="button" className="btn-secondary" onClick={() => { setOpen(false); setPhoto(null); }}>Cancel</button>
      </div>
      {photo && (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consent" className="mt-1 h-5 w-5" required />
            The employee was told that their face is used only to mark attendance, and that a manager can mark attendance for
            them instead if they prefer.
          </label>
          <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save face"}</button>
        </>
      )}
      {state?.error && <p className="text-center text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-center text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
