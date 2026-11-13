import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/**
 * Keeps the camera preview alive.
 * Android can hand back a black preview after the app was swiped away and reopened, or after
 * another screen used the camera. The camera is closed while the app is in the background or the
 * screen is hidden, opened fresh when it comes back, and restarted if it does not start in time.
 * Render <CameraView key={key} onCameraReady={onReady} /> only while `show` is true.
 */
export function useCameraSession() {
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

  const show = appActive && focused;

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
