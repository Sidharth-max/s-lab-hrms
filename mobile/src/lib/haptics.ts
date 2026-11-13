import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Phone haptics. On Android this uses the system's own haptic effects (the same feel as the
// keyboard and system switches), with no vibration permission needed.

const android = Platform.OS === "android";
const ios = Platform.OS === "ios";
const run = (p: Promise<void>) => void p.catch(() => {});

export const haptic = {
  /** Button press. */
  tap: () => (android ? run(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key)) : ios ? run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)) : undefined),
  /** Choosing a tab or option. */
  select: () => (android ? run(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)) : ios ? run(Haptics.selectionAsync()) : undefined),
  toggle: (on: boolean) => (android ? run(Haptics.performAndroidHapticsAsync(on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off)) : ios ? run(Haptics.selectionAsync()) : undefined),
  success: () => (android ? run(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)) : ios ? run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)) : undefined),
  error: () => (android ? run(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)) : ios ? run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)) : undefined),
  warning: () => (android ? run(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)) : ios ? run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)) : undefined),
};
