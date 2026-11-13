import type { ComponentProps } from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextProps, type TextStyle } from "react-native";
import { C } from "@/lib/theme";

// Every text in the app uses the Geist font. React Native has no global default font, so screens
// import Text / TextInput from here instead of "react-native". The weight picks the font file.

export const FONT = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
};

function family(weight: TextStyle["fontWeight"]) {
  const w = weight === "bold" ? 700 : weight === "normal" || weight == null ? 400 : Number(weight);
  if (w >= 700) return FONT.bold;
  if (w >= 600) return FONT.semibold;
  if (w >= 500) return FONT.medium;
  return FONT.regular;
}

function withFont(style: TextProps["style"]) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  // The font file already carries the weight; a separate fontWeight would make Android fake-bold it.
  return { ...flat, fontFamily: flat.fontFamily ?? family(flat.fontWeight), fontWeight: "normal" as const };
}

// React 19 passes `ref` as a normal prop, so it reaches the native component through {...props}.
export function Text({ style, ...props }: ComponentProps<typeof RNText>) {
  return <RNText {...props} style={withFont(style)} />;
}

/** Text box with Geist and our charcoal typing cursor / selection. */
export function TextInput({ style, ...props }: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput cursorColor={C.text} selectionColor="rgba(23,23,23,0.25)" selectionHandleColor={C.text} {...props} style={withFont(style)} />;
}
