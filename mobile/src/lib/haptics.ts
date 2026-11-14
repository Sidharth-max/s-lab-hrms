import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Haptic feedback, only at key moments (choosing an option, toggles, pull-to-refresh, saved / failed,
// the warning before a destructive confirm, face scan steps). Plain button presses, list rows,
// tab presses and opening sheets give no buzz: feedback everywhere made the app feel noisy.
//
// Android: the system haptic constants (performAndroidHapticsAsync = View.performHapticFeedback).
// That is what Android recommends for UI feedback: crisp effects tuned by each phone maker, no
// VIBRATE permission, and it respects the user's "Touch feedback" setting. The old Vibrator
// waveforms (impactAsync & co.) felt buzzy and can ring on after the touch; Android's guidance
// advises against them for clicks. Newer constants need Android 11 (CONFIRM, REJECT, GESTURE_END)
// or 14 (SEGMENT_TICK, TOGGLE_ON/OFF); older phones get the closest constant every version has.
// iOS keeps the Taptic Engine generators, which are already crisp.

const A = Haptics.AndroidHaptics;
const run = (p: Promise<void>) => void p.catch(() => {});
const api = Platform.OS === "android" ? Number(Platform.Version) : 0;

let last = 0;
/** Ignore bursts (e.g. a list re-render firing several events): at most one per 40 ms. */
function gate() {
  const now = Date.now();
  if (now - last < 40) return false;
  last = now;
  return true;
}

function android(modern: Haptics.AndroidHaptics, minApi: number, fallback: Haptics.AndroidHaptics) {
  run(Haptics.performAndroidHapticsAsync(api >= minApi ? modern : fallback));
}

function play(android_: () => void, ios: () => Promise<void>) {
  if (!gate()) return;
  if (Platform.OS === "android") android_();
  else if (Platform.OS === "ios") run(ios());
}

export const haptic = {
  /** Choosing an option, a date or a filter. */
  select: () => play(() => android(A.Segment_Tick, 34, A.Clock_Tick), () => Haptics.selectionAsync()),
  /** A switch turned on or off. */
  toggle: (on: boolean) =>
    play(() => android(on ? A.Toggle_On : A.Toggle_Off, 34, on ? A.Context_Click : A.Clock_Tick), () => Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)),
  /** Saved / done. */
  success: () => play(() => android(A.Confirm, 30, A.Virtual_Key), () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Something failed. */
  error: () => play(() => android(A.Reject, 30, A.Long_Press), () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** Before a destructive action (delete, archive, log out). */
  warning: () => play(() => android(A.Long_Press, 0, A.Long_Press), () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Pull-to-refresh crossed the trigger point / a step in a guided flow was done. */
  heavy: () => play(() => android(A.Gesture_End, 30, A.Context_Click), () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Light tick. Not used for ordinary presses any more; kept for places that opt in. */
  tap: () => play(() => android(A.Virtual_Key, 0, A.Virtual_Key), () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
};
