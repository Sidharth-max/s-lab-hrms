/** Round initials avatar (no photos are stored for employees). */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function Avatar({ name, size = 36, muted = false }: { name: string; size?: number; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight ${muted ? "bg-[var(--soft)] text-[var(--muted)]" : "bg-[var(--brand)] text-[var(--on-brand)]"}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}
