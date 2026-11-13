import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut } from "@/components/icons";
import { logout } from "@/app/actions/auth";
import { requireStaff, getDevice } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type Permission } from "@/lib/permissions";
import { MobileNav, NavLinks, type NavItem } from "@/components/NavLinks";

export default async function StaffLayout({ children }: LayoutProps<"/">) {
  const actor = await requireStaff();
  const [business, device, pending] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
    getDevice(),
    db.approvalRequest.count({ where: { businessId: actor.businessId, status: "PENDING" } }),
  ]);

  const nav: (NavItem & { perm?: Permission; owner?: boolean })[] = [
    { href: "/dashboard", label: "Today", icon: "home", primary: true },
    { href: "/employees", label: "Employees", icon: "employees", primary: true },
    { href: "/attendance", label: "Attendance", icon: "attendance", primary: true },
    { href: "/salary", label: "Salary", icon: "salary", primary: true },
    { href: "/advances", label: "Advances", icon: "advances" },
    { href: "/leaves", label: "Leave", icon: "leave" },
    { href: "/approvals", label: "Approvals", icon: "approvals", badge: pending || undefined },
    { href: "/devices", label: "Devices", icon: "devices", perm: "devices.register" },
    { href: "/team", label: "Managers", icon: "managers", owner: true },
    { href: "/settings", label: "Settings", icon: "settings", perm: "settings.manage" },
    { href: "/audit", label: "History", icon: "history", owner: true },
  ];
  const links = nav
    .filter((n) => (n.owner ? actor.role === "OWNER" : n.perm ? can(actor, n.perm) : true))
    .map(({ href, label, icon, badge, primary }) => ({ href, label, icon, badge, primary }));
  const logoutLabel = device ? "Log out to scanner" : "Log out";

  return (
    <div className="min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-0">
      <header className="no-print sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--card)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--brand)] text-xs font-bold text-[var(--on-brand)]">{business.name.slice(0, 1).toUpperCase()}</span>
            <span className="truncate">{business.name}</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden md:inline muted">
              {actor.name} · {actor.role === "OWNER" ? "Owner" : "Manager"}
            </span>
            <a href="/download" className="hidden link lg:inline">Android app</a>
            <ThemeToggle />
            <form action={logout}>
              <button className="btn-secondary !h-8 !px-3" aria-label={logoutLabel}>
                <LogOut size={15} aria-hidden />
                <span className="hidden sm:inline">{logoutLabel}</span>
              </button>
            </form>
          </div>
        </div>
        <NavLinks links={links} />
      </header>
      {device && (
        <div className="no-print border-b border-[var(--line)] bg-[var(--soft)] px-4 py-1.5 text-center text-xs text-[var(--muted)]">
          {`This device is a scanner (${device.name}). Log out when done so workers only see the face scan.`}
        </div>
      )}
      <main className="cq mx-auto max-w-7xl p-3 sm:p-4">{children}</main>
      <MobileNav
        links={links}
        moreLabel={"More"}
        extra={
          <>
            <a href="/download" className="text-sm link">Download Android app</a>
            <span className="muted w-full text-xs">{actor.name} · {actor.phone}</span>
          </>
        }
      />
    </div>
  );
}
