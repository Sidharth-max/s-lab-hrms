import { Pressable } from "react-native";
import { Refresh } from "./icons";
import { Text } from "./Text";

/** Round glass button on a camera preview: switch between the front and back camera. */
export function CameraSwitch({ facing, onPress, label = true }: { facing: "front" | "back"; onPress: () => void; label?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={facing === "front" ? "Switch to back camera" : "Switch to front camera"}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: label ? 14 : 0, width: label ? undefined : 40, justifyContent: "center", borderRadius: 20, backgroundColor: pressed ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)" })}
    >
      <Refresh size={18} color="#ffffff" />
      {label ? <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{facing === "front" ? "Back camera" : "Front camera"}</Text> : null}
    </Pressable>
  );
}
