/**
 * Employee names the app has already seen (from the Today, Employees, Attendance and Salary lists),
 * so a detail screen can show the person's name in its header on the very first frame.
 *
 * Root cause of the "ID first, then the name" flicker: the employee and attendance-day screens only
 * set their header title after their own API call finished. Until then React Navigation fell back to
 * the route itself (the [id] segment / route name), then swapped to the name when the data arrived:
 * a data-fetching order problem, not slow rendering. Now the title comes from this cache (or the
 * name passed in the route params) synchronously, and the screen body shows a skeleton while loading.
 */
const names = new Map<string, string>();

export function rememberNames(rows: { id?: string; employeeId?: string; name: string }[]) {
  for (const r of rows) {
    const id = r.id ?? r.employeeId;
    if (id && r.name) names.set(id, r.name);
  }
}

export function nameOf(id: string | undefined, fallback?: string): string | undefined {
  return (id && names.get(id)) || fallback || undefined;
}
