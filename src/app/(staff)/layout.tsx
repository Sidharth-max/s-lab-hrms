import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireStaff, getDevice } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type Permission } from "@/lib/permissions";
import { NavLinks } from "@/components/NavLinks";

const NAV: { href: string; label: string; perm?: Permission; owner?: boolean }[] = [
  { href: "/dashboard", label: "Today" },
  { href: "/employees", label: "Employees" },
  { href: "/attendance", label: "Attendance" },
  { href: "/advances", label: "Advances" },
  { href: "/approvals", label: "Approvals" },
  { href: "/payroll", label: "Salary" },
  { href: "/devices", label: "Devices", perm: "devices.register" },
  { href: "/team", label: "Managers", owner: true },
  { href: "/settings", label: "Settings", perm: "settings.manage" },
  { href: "/audit", label: "History", owner: true },
];

export default async function StaffLayout({ children }: LayoutProps<"/">) {
  const actor = await requireStaff();
  const [business, device, pending] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
    getDevice(),
    db.approvalRequest.count({ where: { businessId: actor.businessId, status: "PENDING" } }),
  ]);
  const links = NAV.filter((n) => (n.owner ? actor.role === "OWNER" : n.perm ? can(actor, n.perm) : true)).map((n) => ({
    href: n.href,
    label: n.label,
    badge: n.href === "/approvals" && pending > 0 ? pending : undefined,
  }));

  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-30 border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/dashboard" className="font-bold">{business.name}</Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline muted">
              {actor.name} · {actor.role === "OWNER" ? "Owner" : "Manager"}
            </span>
            <a href="/download" className="hidden text-[var(--brand)] underline sm:inline">Android app</a>
            <form action={logout}>
              <button className="btn-secondary !px-3 !py-1">{device ? "Log out → scanner" : "Log out"}</button>
            </form>
          </div>
        </div>
        <NavLinks links={links} />
      </header>
      {device && (
        <div className="no-print bg-amber-50 px-4 py-1 text-center text-xs text-amber-900">
          This device is a scanner ({device.name}). Log out when done so workers only see the face scan.
        </div>
      )}
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}
