"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useT } from "./LangProvider";

export interface CameraHandle {
  /** Returns a JPEG data URL of the current frame, or null if the camera is not ready. */
  capture(): string | null;
}

/** Front camera preview. Works in browsers and inside the Android app (camera permission needed). */
export const Camera = forwardRef<CameraHandle, { className?: string; mirrored?: boolean }>(function Camera(
  { className = "", mirrored = true },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error(t("Camera not available. Open the site over https.", "कैमरा नहीं मिला। साइट https पर खोलें।"));
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? t("Camera permission denied. Allow camera access and reload.", "कैमरे की अनुमति नहीं मिली। अनुमति दें और फिर खोलें।")
            : (e as Error).message,
        );
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    capture() {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return null;
      const scale = Math.min(1, 960 / v.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.9);
    },
  }));

  if (error) return <div className={`flex items-center justify-center bg-gray-900 p-4 text-center text-white ${className}`}>{error}</div>;
  return (
    <video
      ref={videoRef}
      playsInline
      muted
      className={`bg-black object-cover ${mirrored ? "-scale-x-100" : ""} ${className}`}
    />
  );
});
