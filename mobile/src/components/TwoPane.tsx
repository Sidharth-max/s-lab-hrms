import { View } from "react-native";
import { Text } from "./Text";
import { LIST_MIN_WIDTH, useWindowLayout, RAIL_WIDTH } from "@/lib/layout";
import { C } from "@/lib/theme";

/**
 * List-detail canonical layout for an open foldable / tablet (both panes on screen at once).
 * List a little narrower than the detail: 42:58 on an open foldable, 40:60 for 600–959 dp, 34:66 from
 * 960 dp, and never under LIST_MIN_WIDTH (nor over half). Only rendered when useWindowLayout().twoPane is true.
 */
export function TwoPane({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  const { width, listFraction, rail } = useWindowLayout();
  const content = width - (rail ? RAIL_WIDTH : 0);
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: C.bg }}>
      <View style={{ width: Math.min(Math.max(Math.round(content * listFraction), LIST_MIN_WIDTH), Math.round(content * 0.5)), borderRightWidth: 1, borderRightColor: C.hairline }}>{left}</View>
      <View style={{ flex: 1 }}>{right}</View>
    </View>
  );
}

/** Shown on the right until something is chosen on the left. */
export function PanePlaceholder({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: C.brandSoft, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <Text style={{ color: C.muted, fontSize: 15, textAlign: "center", maxWidth: 280 }}>{text}</Text>
    </View>
  );
}
