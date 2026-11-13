// Manager permissions. The owner (OP) always has every permission.

export const PERMISSIONS = {
  "employees.manage": "Add and edit employees, enroll faces",
  "salary.edit": "Change wages and PF / ESIC switches",
  "attendance.edit": "Edit past attendance",
  "advances.manage": "Give advances",
  "approvals.decide": "Approve advances (when the balance goes negative), same as the owner",
  "payroll.run": "See salary balances and add extra pay or deductions",
  "payroll.lock": "Pay salary (clear hisaab)",
  "devices.register": "Register and remove scanner devices",
  "settings.manage": "Change sites, holidays and attendance rules",
} as const;

export type Permission = keyof typeof PERMISSIONS;

/** Permissions shown in sections on the manager form. */
export const PERMISSION_GROUPS: { title: string; keys: Permission[] }[] = [
  { title: "Employees", keys: ["employees.manage", "salary.edit"] },
  { title: "Attendance", keys: ["attendance.edit"] },
  { title: "Advances", keys: ["advances.manage", "approvals.decide"] },
  { title: "Salary", keys: ["payroll.run", "payroll.lock"] },
  { title: "Business", keys: ["devices.register", "settings.manage"] },
];

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(p: string): p is Permission {
  return p in PERMISSIONS;
}

export interface Actor {
  id: string;
  businessId: string;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  permissions: string[];
  siteIds: string[];
  name: string;
  phone: string;
}

export function can(actor: Actor, p: Permission): boolean {
  if (actor.role === "OWNER") return true;
  if (actor.role !== "MANAGER") return false;
  return actor.permissions.includes(p);
}

/** Sites the actor may see; null means all sites. */
export function siteScope(actor: Actor): string[] | null {
  if (actor.role === "OWNER" || actor.siteIds.length === 0) return null;
  return actor.siteIds;
}

export function canSeeSite(actor: Actor, siteId: string): boolean {
  const scope = siteScope(actor);
  return scope === null || scope.includes(siteId);
}
