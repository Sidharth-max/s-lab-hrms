import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Keeps the camera preview alive.
 * Android can hand back a black preview after the app was swiped away and reopened, or after
 * another screen used the camera. The camera is closed while the app is in the background or the
 * screen is hidden, opened fresh when it comes back, and restarted if it does not start in time.
 * Render <CameraView key={key} onCameraReady={onReady} /> only while `show` is true.
 */
/** `enabled` = false keeps the camera off (e.g. the scanner waiting for a tap). */
export function useCameraSession(enabled = true) {
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [focused, setFocused] = useState(false);
  const [key, setKey] = useState(0);
  const [ready, setReady] = useState(false);
  const tries = useRef(0);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      const active = s === "active";
      setAppActive(active);
      setReady(false);
      if (active) {
        tries.current = 0;
        setKey((k) => k + 1);
      }
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setReady(false);
      tries.current = 0;
      setKey((k) => k + 1);
      return () => setFocused(false);
    }, []),
  );

  const show = appActive && focused && enabled;
  // Turning the camera on again starts a fresh session (adjusted while rendering, not in an effect).
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (enabled) {
      setReady(false);
      setKey((k) => k + 1);
    }
  }

  // Watchdog: if the preview has not started after 4 s, open the camera again (up to 3 times).
  useEffect(() => {
    if (!show || ready) return;
    const t = setTimeout(() => {
      if (tries.current < 3) {
        tries.current += 1;
        setKey((k) => k + 1);
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [show, ready, key]);

  const onReady = useCallback(() => setReady(true), []);
  return { show, key, ready, onReady, restart: () => { tries.current = 0; setReady(false); setKey((k) => k + 1); } };
}

const FACING_KEY = "hrms.cameraFacing";

function readFacing(): "front" | "back" {
  try {
    const v = Platform.OS === "web" ? globalThis.localStorage?.getItem(FACING_KEY) : SecureStore.getItem(FACING_KEY);
    return v === "back" ? "back" : "front";
  } catch {
    return "front";
  }
}

/**
 * Front or back camera for face screens, remembered on this phone (a scanner tablet mounted the other
 * way round keeps the back camera). Use `facing` on <CameraView> and mirror only the front camera.
 */
export function useCameraFacing() {
  const [facing, setFacing] = useState<"front" | "back">(readFacing);
  const toggle = useCallback(() => {
    setFacing((f) => {
      const next = f === "front" ? "back" : "front";
      try {
        if (Platform.OS === "web") globalThis.localStorage?.setItem(FACING_KEY, next);
        else void SecureStore.setItemAsync(FACING_KEY, next);
      } catch {
        // Not remembered: still switches for now.
      }
      return next;
    });
  }, []);
  return { facing, toggle, mirror: facing === "front" };
}
