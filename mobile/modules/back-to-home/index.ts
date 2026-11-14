import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

// See android/src/main/java/expo/modules/backtohome/BackToHomeModule.kt.
const native = Platform.OS === "android" ? requireOptionalNativeModule<{ setAtRoot(atRoot: boolean): boolean }>("BackToHome") : null;

/** True on the start screen: Android plays its own back-to-home preview and closes the app. */
export function setAtRoot(atRoot: boolean) {
  try {
    native?.setAtRoot(atRoot);
  } catch {
    // older app build without the module: JavaScript keeps handling Back
  }
}
