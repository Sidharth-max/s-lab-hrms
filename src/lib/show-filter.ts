// "Active / All / Archived" filter for attendance lists. Default: active employees only.
export type ShowFilter = "active" | "all" | "archived";

export function parseShow(v: unknown): ShowFilter {
  return v === "all" || v === "archived" ? v : "active";
}

/** Prisma where-part for the filter. */
export function showWhere(show: ShowFilter): { active?: boolean } {
  return show === "all" ? {} : { active: show === "active" };
}
