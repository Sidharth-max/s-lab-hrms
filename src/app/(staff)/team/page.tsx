import { saveManager, toggleManager } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import type { T } from "@/lib/i18n";
import { ALL_PERMISSIONS, PERMISSIONS, type Permission } from "@/lib/permissions";

const PERMISSIONS_HI: Record<Permission, string> = {
  "employees.manage": "कर्मचारी जोड़ना/बदलना, चेहरा दर्ज करना",
  "salary.edit": "वेतन और PF / ESIC बदलना",
  "attendance.edit": "पुरानी हाज़िरी बदलना",
  "advances.manage": "एडवांस देना",
  "approvals.decide": "माइनस बैलेंस वाला एडवांस मंज़ूर करना",
  "payroll.run": "महीने की सैलरी बनाना और एडजस्टमेंट जोड़ना",
  "payroll.lock": "सैलरी लॉक करना और भुगतान दर्ज करना",
  "devices.register": "स्कैनर डिवाइस जोड़ना और हटाना",
  "settings.manage": "साइट, छुट्टियाँ और हाज़िरी नियम बदलना",
};

function ManagerFields({
  t,
  sites,
  m,
}: {
  t: T;
  sites: { id: string; name: string }[];
  m?: { id: string; name: string; phone: string; permissions: string[]; siteIds: string[] };
}) {
  return (
    <div className="flex flex-col gap-3">
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="grid gap-3 @xl:grid-cols-2">
        <div><label className="label">{t("Name", "नाम")}</label><input name="name" className="input" defaultValue={m?.name} required /></div>
        <div><label className="label">{t("Mobile (used to log in)", "मोबाइल (लॉग इन के लिए)")}</label><input name="phone" className="input" inputMode="numeric" defaultValue={m?.phone} required /></div>
      </div>
      <div>
        <div className="label">{t("Can do", "क्या कर सकते हैं")}</div>
        <div className="grid gap-1 @xl:grid-cols-2">
          {ALL_PERMISSIONS.map((p) => (
            <label key={p} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="permissions" value={p} defaultChecked={m?.permissions.includes(p)} className="mt-0.5 h-4 w-4" />
              {t(PERMISSIONS[p], PERMISSIONS_HI[p])}
            </label>
          ))}
        </div>
        <p className="muted mt-1">
          {t("Everyone can view today's attendance, employees, advances and salary for their sites.", "सभी अपनी साइट की आज की हाज़िरी, कर्मचारी, एडवांस और सैलरी देख सकते हैं।")}
        </p>
      </div>
      <div>
        <div className="label">{t("Sites (none ticked = all sites)", "साइट (कोई न चुनें = सभी साइट)")}</div>
        <div className="flex flex-wrap gap-3">
          {sites.map((s) => (
            <label key={s.id} className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="siteIds" value={s.id} defaultChecked={m?.siteIds.includes(s.id)} /> {s.name}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function TeamPage() {
  const actor = await requireOwner();
  const { t } = await getT();
  const [managers, sites, owners] = await Promise.all([
    db.user.findMany({ where: { businessId: actor.businessId, role: "MANAGER" }, orderBy: { name: "asc" } }),
    db.site.findMany({ where: { businessId: actor.businessId }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { businessId: actor.businessId, role: "OWNER" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">{t("Managers", "मैनेजर")}</h1>
      <p className="muted">
        {t("Owner (full control, approves by OTP):", "मालिक (पूरा कंट्रोल, OTP से मंज़ूरी):")} {owners.map((o) => `${o.name} (${o.phone})`).join(", ")}
      </p>
      <section className="card">
        <h2 className="font-semibold">+ {t("Add manager", "मैनेजर जोड़ें")}</h2>
        <ActionForm action={saveManager} className="mt-3 flex flex-col gap-3" submitLabel={t("Add manager", "मैनेजर जोड़ें")} resetOnSuccess>
          <ManagerFields t={t} sites={sites} />
        </ActionForm>
      </section>
      {managers.map((m) => (
        <details key={m.id} className="card">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              {m.name} <span className="muted">{m.phone}</span> {!m.active && <span className="badge bg-gray-200">{t("disabled", "बंद")}</span>}
            </span>
            <span className="muted">
              {m.permissions.length === ALL_PERMISSIONS.length ? t("Full access", "पूरी अनुमति") : t(`${m.permissions.length} permissions`, `${m.permissions.length} अनुमतियाँ`)}
            </span>
          </summary>
          <ActionForm action={saveManager} className="mt-3 flex flex-col gap-3">
            <ManagerFields t={t} sites={sites} m={m} />
          </ActionForm>
          <div className="mt-3">
            <ActionForm action={toggleManager} submitLabel={m.active ? t("Disable login", "लॉग इन बंद करें") : t("Enable login", "लॉग इन चालू करें")} submitClass={m.active ? "btn-danger" : "btn-secondary"}>
              <input type="hidden" name="id" value={m.id} />
            </ActionForm>
          </div>
        </details>
      ))}
    </div>
  );
}
