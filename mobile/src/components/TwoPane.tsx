import { View } from "react-native";
import { Text } from "./Text";
import { LIST_PANE } from "@/lib/layout";
import { C } from "@/lib/theme";

/** List on the left, details on the right (open foldable / tablet). */
export function TwoPane({ left, right, leftWidth = LIST_PANE }: { left: React.ReactNode; right: React.ReactNode; leftWidth?: number }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: C.bg }}>
      <View style={{ width: leftWidth, borderRightWidth: 1, borderRightColor: C.line }}>{left}</View>
      <View style={{ flex: 1 }}>{right}</View>
    </View>
  );
}

/** Shown on the right until something is chosen on the left. */
export function PanePlaceholder({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 }}>
      {icon}
      <Text style={{ color: C.muted, fontSize: 15, textAlign: "center" }}>{text}</Text>
    </View>
  );
}
