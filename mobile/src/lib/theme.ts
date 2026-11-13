import * as SecureStore from "expo-secure-store";
import { Appearance, Platform } from "react-native";

// Corporate palette (reference: the analytics dashboard): cool grey canvas, white cards, near-black
// type and buttons, and an indigo-to-blue brand gradient used only for hero areas.
// Colour lives in the TEXT (amounts, labels, numbers), not in big coloured backgrounds:
// every "ink" below passes WCAG AA (4.5:1) for normal text on its theme's card colour
// (checked by scripts/check-contrast.mjs).
// The palette is chosen once when the app starts (from the saved choice, or the phone's setting);
// changing it reloads the app, so every screen uses plain constants.

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
  bg: "#f3f4f7",
  card: "#ffffff",
  text: "#111318",
  muted: "#5f6573",
  line: "#e4e6eb",
  hairline: "#eaecf0", // card and input edges
  soft: "#f4f5f8",
  track: "#eef0f4", // chips, neutral badges, pill tracks
  trackPressed: "#e3e6ec",
  placeholder: "#9aa0ab",
  faint: "#c3c7cf",
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
  head: "#111318",
  headText: "#ffffff",
  headMuted: "#9aa0ab",
  // Brand: indigo to blue. Used for hero gradients, the active tab, focus rings and links.
  brand: "#4f46e5",
  brandSoft: "#eef0ff",
  brandInk: "#4338ca",
  gradient: ["#6a1bff", "#4a3cff", "#1f6bff"] as [string, string, string],
  glass: "rgba(255,255,255,0.18)",
  // Text inks (amounts and labels). Paired soft tints for the small chips behind icons.
  ink: {
    green: "#15803d", // money coming in, present, cleared
    blue: "#1d4ed8", // salary paid
    violet: "#6d28d9", // earned
    orange: "#c2410c", // advance given
    pink: "#be185d", // extra pay
    teal: "#0f766e", // in-time, inside now
    red: "#b91c1c", // owed, absent, deduction
    amber: "#92590a", // half day, waiting
  },
  tint: {
    green: "#e7f7ec",
    blue: "#e8efff",
    violet: "#f1ebff",
    orange: "#fff0e6",
    pink: "#fdebf3",
    teal: "#e3f6f4",
    red: "#fdecec",
    amber: "#fdf4dc",
  },
  shadow: "#0f172a",
};

const dark: typeof light = {
  bg: "#0b0c10",
  card: "#16181d",
  text: "#eceef2",
  muted: "#a0a6b2",
  line: "#2a2d35",
  hairline: "#23262d",
  soft: "#1d2026",
  track: "#22252c",
  trackPressed: "#2c3038",
  placeholder: "#6b707b",
  faint: "#474b55",
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
  white: "#16181d",
  head: "#eceef2",
  headText: "#0b0c10",
  headMuted: "#6b707b",
  brand: "#8b8cff",
  brandSoft: "#1f2140",
  brandInk: "#a5b4fc",
  gradient: ["#5214d6", "#3a2ee0", "#1856e0"] as [string, string, string],
  glass: "rgba(255,255,255,0.12)",
  ink: {
    green: "#4ade80",
    blue: "#7aa7ff",
    violet: "#b49cff",
    orange: "#fb9a5b",
    pink: "#f58cc0",
    teal: "#3fd9c5",
    red: "#f88a8a",
    amber: "#f5c451",
  },
  tint: {
    green: "#12301d",
    blue: "#16233f",
    violet: "#241c3f",
    orange: "#33200f",
    pink: "#341726",
    teal: "#0f2e2b",
    red: "#351717",
    amber: "#30270d",
  },
  shadow: "#000000",
};

export type Ink = keyof typeof light.ink;
export const C = isDark ? dark : light;
export const PALETTES = { light, dark };

export const R = { sm: 8, md: 12, lg: 16, xl: 24 };

/** Soft card shadow (Android elevation + iOS shadow). */
export const shadow = (level: 1 | 2 | 3 = 1) => ({
  shadowColor: C.shadow,
  shadowOpacity: isDark ? 0.4 : [0.04, 0.08, 0.14][level - 1],
  shadowRadius: [6, 14, 24][level - 1],
  shadowOffset: { width: 0, height: [2, 6, 10][level - 1] },
  elevation: [1, 4, 10][level - 1],
});

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

/** Text ink per money movement, the same on web (CSS vars --ink-*) and app. */
export const MONEY_INK = {
  earned: "violet",
  extra: "pink",
  advance: "orange",
  payment: "blue",
  deduction: "red",
  balance: "green",
  owed: "red",
} as const satisfies Record<string, Ink>;
