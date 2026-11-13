// Only charcoal, white, red (errors, absent) and green (success, present). Greys are tints of charcoal.
export const C = {
  bg: "#fafafa",
  card: "#ffffff",
  text: "#171717",
  muted: "#666666",
  line: "#e5e5e5",
  soft: "#f4f4f4",
  red: "#dc2626",
  redSoft: "#fef2f2",
  green: "#16a34a",
  greenSoft: "#f0fdf4",
  amber: "#b45309", // half day
  amberSoft: "#fffbeb",
  amberLine: "#fde68a",
  white: "#ffffff",
  // Two-tone: charcoal header bar and status bar over light content.
  head: "#171717",
  headText: "#ffffff",
  headMuted: "#a3a3a3",
};

export const R = { sm: 6, md: 8, lg: 12 };

/** Colour for an attendance status: present green, half day yellow, absent / unpaid leave red. */
export function statusTone(status: string): "green" | "amber" | "red" | "neutral" {
  if (status === "PRESENT") return "green";
  if (status === "HALF_DAY") return "amber";
  if (status === "ABSENT" || status === "UNPAID_LEAVE") return "red";
  return "neutral";
}
