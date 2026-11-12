import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireStaff, getDevice } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { can, type Permission } from "@/lib/permissions";
import { MobileNav, NavLinks, type NavItem } from "@/components/NavLinks";
import { LanguageSwitch } from "@/components/LanguageSwitch";

export default async function StaffLayout({ children }: LayoutProps<"/">) {
  const actor = await requireStaff();
  const { t } = await getT();
  const [business, device, pending] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
    getDevice(),
    db.approvalRequest.count({ where: { businessId: actor.businessId, status: "PENDING" } }),
  ]);

  const nav: (NavItem & { perm?: Permission; owner?: boolean })[] = [
    { href: "/dashboard", label: t("Today", "आज"), icon: "🏠", primary: true },
    { href: "/employees", label: t("Employees", "कर्मचारी"), icon: "👥", primary: true },
    { href: "/attendance", label: t("Attendance", "हाज़िरी"), icon: "🗓️", primary: true },
    { href: "/payroll", label: t("Salary", "सैलरी"), icon: "₹", primary: true },
    { href: "/advances", label: t("Advances", "एडवांस"), icon: "💵" },
    { href: "/approvals", label: t("Approvals", "मंज़ूरी"), icon: "✅", badge: pending || undefined },
    { href: "/devices", label: t("Devices", "डिवाइस"), icon: "📱", perm: "devices.register" },
    { href: "/team", label: t("Managers", "मैनेजर"), icon: "🧑‍💼", owner: true },
    { href: "/settings", label: t("Settings", "सेटिंग"), icon: "⚙️", perm: "settings.manage" },
    { href: "/audit", label: t("History", "इतिहास"), icon: "📜", owner: true },
  ];
  const links = nav
    .filter((n) => (n.owner ? actor.role === "OWNER" : n.perm ? can(actor, n.perm) : true))
    .map(({ href, label, icon, badge, primary }) => ({ href, label, icon, badge, primary }));
  const logoutLabel = device ? t("Log out → scanner", "लॉग आउट → स्कैनर") : t("Log out", "लॉग आउट");

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <header className="no-print sticky top-0 z-30 border-b border-[var(--line)] bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/dashboard" className="truncate font-bold">{business.name}</Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden md:inline muted">
              {actor.name} · {actor.role === "OWNER" ? t("Owner", "मालिक") : t("Manager", "मैनेजर")}
            </span>
            <LanguageSwitch className="hidden sm:inline-flex" />
            <a href="/download" className="hidden text-[var(--brand)] underline lg:inline">{t("Android app", "एंड्रॉइड ऐप")}</a>
            <form action={logout}>
              <button className="btn-secondary !px-3 !py-1">{logoutLabel}</button>
            </form>
          </div>
        </div>
        <NavLinks links={links} />
      </header>
      {device && (
        <div className="no-print bg-amber-50 px-4 py-1 text-center text-xs text-amber-900">
          {t(
            `This device is a scanner (${device.name}). Log out when done so workers only see the face scan.`,
            `यह डिवाइस स्कैनर है (${device.name})। काम ख़त्म होने पर लॉग आउट करें ताकि कर्मचारियों को सिर्फ़ फ़ेस स्कैन दिखे।`,
          )}
        </div>
      )}
      <main className="cq mx-auto max-w-7xl p-3 sm:p-4">{children}</main>
      <MobileNav
        links={links}
        moreLabel={t("More", "और")}
        extra={
          <>
            <LanguageSwitch />
            <a href="/download" className="text-sm text-[var(--brand)] underline">{t("Download Android app", "एंड्रॉइड ऐप डाउनलोड करें")}</a>
            <span className="muted w-full text-xs">{actor.name} · {actor.phone}</span>
          </>
        }
      />
    </div>
  );
}
