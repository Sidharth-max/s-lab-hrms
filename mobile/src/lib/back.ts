import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { AppState, BackHandler } from "react-native";
import { setAtRoot } from "../../modules/back-to-home";

/**
 * On the start screen (Today), one Back / back swipe closes the app.
 *
 * Android 13+ predictive back: while Today is in front, Back is handed to Android itself (see the
 * back-to-home native module), so the swipe shows the system's back-to-home preview. Sheets and
 * dialogs are their own windows and still get Back first. The JavaScript handler below stays as a
 * fallback (older builds, or if React Native turned its callback back on).
 */
export function useExitOnBack() {
  useFocusEffect(
    useCallback(() => {
      setAtRoot(true);
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        BackHandler.exitApp();
        return true;
      });
      // React Native creates a fresh callback when the screen is rebuilt: hand Back over again.
      const app = AppState.addEventListener("change", (s) => {
        if (s === "active") setAtRoot(true);
      });
      return () => {
        setAtRoot(false);
        sub.remove();
        app.remove();
      };
    }, []),
  );
}
