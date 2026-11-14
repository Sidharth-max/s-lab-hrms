"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { RotateCcw as Refresh } from "./icons";

export interface CameraHandle {
  /** Returns a JPEG data URL of the current frame, or null if the camera is not ready. */
  capture(): string | null;
}

const FACING_KEY = "hrms.cameraFacing";

/**
 * Camera preview with a front / back switch (remembered in this browser, so a scanner tablet
 * mounted the other way keeps the back camera). The front camera preview is mirrored like a
 * selfie; captured photos are never mirrored.
 */
export const Camera = forwardRef<CameraHandle, { className?: string; mirrored?: boolean; switchPosition?: "top-right" | "bottom-right"; /** Called once the picture is showing (ready to capture). */ onReady?: () => void }>(function Camera(
  { className = "", mirrored = true, switchPosition = "top-right", onReady },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  });
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  // Read the saved choice after mount (localStorage is not available while rendering on the server).
  useEffect(() => {
    try {
      if (localStorage.getItem(FACING_KEY) === "back") setFacing("environment");
    } catch {
      // Private mode: start with the front camera.
    }
  }, []);
  const toggle = () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    setError(null);
    try {
      localStorage.setItem(FACING_KEY, next === "environment" ? "back" : "front");
    } catch {
      // Not remembered: still switches for now.
    }
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not available. Open the site over https.");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          // Ready once frames arrive (videoWidth is known).
          const v = videoRef.current;
          const fire = () => { if (!cancelled && v.videoWidth) onReadyRef.current?.(); };
          if (v.videoWidth) fire();
          else v.addEventListener("loadeddata", fire, { once: true });
        }
      } catch (e) {
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access and reload."
            : (e as Error).message,
        );
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing]);

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

  const switchButton = (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      aria-label={facing === "user" ? "Switch to back camera" : "Switch to front camera"}
      className={`absolute z-10 inline-flex h-10 items-center gap-1.5 rounded-full bg-black/50 px-3.5 text-[13px] font-semibold text-white backdrop-blur hover:bg-black/70 ${switchPosition === "top-right" ? "top-3 right-3" : "right-3 bottom-3"}`}
    >
      <Refresh size={17} aria-hidden />
      {facing === "user" ? "Back camera" : "Front camera"}
    </button>
  );
  if (error) {
    return (
      <div className={`relative flex items-center justify-center bg-gray-900 p-4 text-center text-white ${className}`}>
        {error}
        {switchButton}
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <video
        ref={videoRef}
        playsInline
        muted
        className={`h-full w-full object-cover ${mirrored && facing === "user" ? "-scale-x-100" : ""}`}
      />
      {switchButton}
    </div>
  );
});
