/** Round initials avatar (no photos are stored for employees). */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

const INKS = ["violet", "blue", "teal", "pink", "orange", "green"] as const;

/** Tint chosen from the name (same rule as the app), so people are easy to tell apart. */
export function nameInk(name: string) {
  return INKS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % INKS.length];
}

export function Avatar({ name, size = 36, muted = false }: { name: string; size?: number; muted?: boolean }) {
  const ink = nameInk(name);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: muted ? "var(--soft)" : `var(--tint-${ink})`,
        color: muted ? "var(--muted)" : `var(--ink-${ink})`,
      }}
    >
      {initials(name)}
    </span>
  );
}
