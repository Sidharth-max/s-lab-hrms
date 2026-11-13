"use client";

import { useActionState, useRef, useState } from "react";
import { enrollFace } from "@/app/actions/employees";
import { Camera, type CameraHandle } from "./Camera";

/** Three photos from slightly different angles make the scanner recognise the person more reliably. */
const FACE_STEPS = ["Look straight at the camera", "Turn the head a little to the left", "Turn the head a little to the right"];

export function FaceEnroll({ employeeId, enrolled }: { employeeId: string; enrolled: boolean }) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const cam = useRef<CameraHandle>(null);
  const [state, action, pending] = useActionState(enrollFace, null);
  const done = photos.length >= FACE_STEPS.length;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          {enrolled ? "Re-take face photos" : "Enroll face"}
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
      {photos.map((p, i) => <input key={i} type="hidden" name="image" value={p} />)}
      {!done && (
        <>
          <p className="text-center font-medium">
            Photo {photos.length + 1} of {FACE_STEPS.length}: {FACE_STEPS[photos.length]}
          </p>
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl">
            <Camera ref={cam} className="aspect-[3/4] w-full" />
          </div>
          <p className="muted text-center">Good light, no cap, mask or dark glasses.</p>
        </>
      )}
      {photos.length > 0 && (
        <div className="flex justify-center gap-2">
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt={`Face photo ${i + 1}`} className="aspect-[3/4] w-20 -scale-x-100 rounded-lg object-cover" />
          ))}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {!done && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              const p = cam.current?.capture();
              if (p) setPhotos((list) => [...list, p]);
            }}
          >
            Take photo {photos.length + 1}
          </button>
        )}
        {photos.length > 0 && <button type="button" className="btn-secondary" onClick={() => setPhotos([])}>Start again</button>}
        <button type="button" className="btn-secondary" onClick={() => { setOpen(false); setPhotos([]); }}>Cancel</button>
      </div>
      {done && (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consent" className="mt-1 h-5 w-5" required />
            {"The employee was told that their face is used only to mark attendance, and that a manager can mark attendance for them instead if they prefer."}
          </label>
          <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save face"}</button>
        </>
      )}
      {state?.error && <p className="text-center text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-center text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
