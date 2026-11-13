import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";

/**
 * On the start screen (Today), one Back / back swipe closes the app.
 * Modals (sheets, dialogs) get the Back press first, so an open sheet is closed instead.
 */
export function useExitOnBack() {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        BackHandler.exitApp();
        return true;
      });
      return () => sub.remove();
    }, []),
  );
}
