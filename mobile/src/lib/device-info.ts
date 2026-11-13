import * as Application from "expo-application";
import * as Device from "expo-device";
import { Platform } from "react-native";

/** Identifies this phone/tablet so registering it again as a scanner updates the same entry. */
export function deviceInfo(): { hardwareId: string | null; model: string | null } {
  let hardwareId: string | null = null;
  try {
    hardwareId = Platform.OS === "android" ? Application.getAndroidId() : null;
  } catch {
    hardwareId = null;
  }
  const model = [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || null;
  return { hardwareId, model };
}
