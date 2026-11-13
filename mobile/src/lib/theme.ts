import * as SecureStore from "expo-secure-store";
import { Appearance, Platform } from "react-native";

// Colours: charcoal, white, red (errors, absent), green (success, present), amber (half day).
// Light and dark palettes. The palette is chosen once when the app starts (from the saved choice,
// or the phone's setting); changing it reloads the app, so every screen uses plain constants.

export type ThemePref = "system" | "light" | "dark";
const KEY = "hrms.theme";

function readPref(): ThemePref {
  try {
    const v = Platform.OS === "web" ? globalThis.localStorage?.getItem(KEY) : SecureStore.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export const themePref: ThemePref = readPref();
export const isDark = themePref === "dark" || (themePref === "system" && Appearance.getColorScheme() === "dark");

const light = {
  bg: "#fafafa",
  card: "#ffffff",
  text: "#171717",
  muted: "#666666",
  line: "#e5e5e5",
  hairline: "#ebebeb", // card and input edges
  soft: "#f4f4f4",
  track: "#f1f1f1", // chips, neutral badges, pill tracks
  trackPressed: "#e9e9e9",
  placeholder: "#a3a3a3",
  faint: "#c4c4c4",
  red: "#dc2626",
  redSoft: "#fef2f2",
  redLine: "#fecaca",
  redTint: "#fde8e8",
  redInk: "#b91c1c",
  green: "#16a34a",
  greenSoft: "#f0fdf4",
  greenLine: "#bbf7d0",
  greenTint: "#dcfce7",
  greenInk: "#15803d",
  amber: "#b45309", // half day
  amberSoft: "#fffbeb",
  amberLine: "#fde68a",
  amberTint: "#fef3c7",
  amberInk: "#a16207",
  /** Surface colour, and the text / icon colour on charcoal buttons. */
  white: "#ffffff",
  // Filled accents (avatars, add button, chosen day): charcoal with white text.
  head: "#171717",
  headText: "#ffffff",
  headMuted: "#a3a3a3",
};

const dark: typeof light = {
  bg: "#0a0a0a",
  card: "#161616",
  text: "#ededed",
  muted: "#a1a1a1",
  line: "#2e2e2e",
  hairline: "#262626",
  soft: "#1f1f1f",
  track: "#242424",
  trackPressed: "#2e2e2e",
  placeholder: "#6b6b6b",
  faint: "#4a4a4a",
  red: "#ef4444",
  redSoft: "#2a1414",
  redLine: "#5c1f1f",
  redTint: "#3b1515",
  redInk: "#fca5a5",
  green: "#22c55e",
  greenSoft: "#0f2417",
  greenLine: "#14532d",
  greenTint: "#11351f",
  greenInk: "#86efac",
  amber: "#fbbf24",
  amberSoft: "#2a2008",
  amberLine: "#5c4a12",
  amberTint: "#3a2c0a",
  amberInk: "#fcd34d",
  // In dark mode "white" is the dark surface, so buttons invert: light button, dark label.
  white: "#161616",
  head: "#ededed",
  headText: "#0a0a0a",
  headMuted: "#6b6b6b",
};

export const C = isDark ? dark : light;

export const R = { sm: 6, md: 8, lg: 12 };

/** Saves the choice and restarts the app so every screen picks up the new colours. */
export async function setThemePref(pref: ThemePref) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(KEY, pref);
    globalThis.location?.reload();
    return;
  }
  await SecureStore.setItemAsync(KEY, pref);
  const { reloadAppAsync } = await import("expo");
  await reloadAppAsync();
}

/** Colour for an attendance status: present green, half day yellow, absent / unpaid leave red. */
export function statusTone(status: string): "green" | "amber" | "red" | "neutral" {
  if (status === "PRESENT") return "green";
  if (status === "HALF_DAY") return "amber";
  if (status === "ABSENT" || status === "UNPAID_LEAVE") return "red";
  return "neutral";
}
