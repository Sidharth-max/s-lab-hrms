import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Haptic feedback for the whole app.
//
// Why there was "no haptics" before: Android used performAndroidHapticsAsync, which goes through
// View.performHapticFeedback(). Android silently drops those when the phone's "Touch feedback"
// setting is off, and several constants we used (CONFIRM, REJECT, SEGMENT_TICK, TOGGLE_ON/OFF)
// only exist on Android 11 / 14+ and are ignored by many One UI builds. So on most phones nothing
// happened. impactAsync / notificationAsync / selectionAsync drive the Vibrator directly with short
// waveforms (expo-haptics declares the VIBRATE permission), which works on every Android phone.

const run = (p: Promise<void>) => void p.catch(() => {});
const native = Platform.OS === "android" || Platform.OS === "ios";

let last = 0;
/** Ignore bursts (e.g. a list re-render firing several taps): at most one buzz per 40 ms. */
function gate() {
  const now = Date.now();
  if (now - last < 40) return false;
  last = now;
  return true;
}

export const haptic = {
  /** Light tick: buttons, list rows, tab presses. */
  tap: () => native && gate() && run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Choosing an option, date or tab. */
  select: () => native && gate() && run(Haptics.selectionAsync()),
  /** Opening a sheet or menu. */
  open: () => native && gate() && run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  toggle: (on: boolean) => native && gate() && run(Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)),
  success: () => native && gate() && run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => native && gate() && run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warning: () => native && gate() && run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Pull-to-refresh crossed the trigger point / a step in a guided flow was done. */
  heavy: () => native && gate() && run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
};
