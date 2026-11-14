import { UserCog, UserPlus } from "@/components/icons";
import { PageHero, SectionTitle } from "@/components/PageHero";
import { Avatar } from "@/components/Avatar";
import { saveManager, toggleManager } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSIONS } from "@/lib/permissions";

function ManagerFields({
  sites,
  m,
}: {
  sites: { id: string; name: string }[];
  m?: { id: string; name: string; phone: string; permissions: string[]; siteIds: string[] };
}) {
  return (
    <div className="flex flex-col gap-3">
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="grid gap-3 @xl:grid-cols-2">
        <div><label className="label">Name</label><input name="name" className="input" defaultValue={m?.name} required /></div>
        <div><label className="label">Mobile (used to log in)</label><input name="phone" className="input" inputMode="numeric" defaultValue={m?.phone} required /></div>
      </div>
      <div>
        <div className="label">Can do</div>
        <div className="grid gap-3 @xl:grid-cols-2">
          {PERMISSION_GROUPS.map((g) => (
            <fieldset key={g.title} className="rounded-lg border border-[var(--line)] p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{g.title}</legend>
              <div className="flex flex-col gap-2">
                {g.keys.map((p) => (
                  <label key={p} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="permissions" value={p} defaultChecked={m?.permissions.includes(p)} className="mt-0.5 h-4 w-4" />
                    {PERMISSIONS[p]}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <p className="muted mt-1">
          {"Everyone can view today's attendance, employees, advances and salary for their sites."}
        </p>
      </div>
      <div>
        <div className="label">Sites (none ticked = all sites)</div>
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
  const [managers, sites, owners] = await Promise.all([
    db.user.findMany({ where: { businessId: actor.businessId, role: "MANAGER" }, orderBy: { name: "asc" } }),
    db.site.findMany({ where: { businessId: actor.businessId }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { businessId: actor.businessId, role: "OWNER" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHero
        icon={<UserCog size={24} />}
        eyebrow="Managers"
        title={`${managers.filter((m) => m.active).length} active manager${managers.filter((m) => m.active).length === 1 ? "" : "s"}`}
        subtitle={`Owner (full control, approves by OTP): ${owners.map((o) => `${o.name} (${o.phone})`).join(", ")}`}
      />
      <section className="card">
        <SectionTitle icon={<UserPlus size={18} />} ink="violet">Add manager</SectionTitle>
        <ActionForm action={saveManager} className="mt-3 flex flex-col gap-3" submitLabel={"Add manager"} resetOnSuccess>
          <ManagerFields sites={sites} />
        </ActionForm>
      </section>
      {managers.map((m) => (
        <details key={m.id} className="card">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2.5 font-semibold">
              <Avatar name={m.name} size={34} muted={!m.active} />
              {m.name} <span className="muted">{m.phone}</span> {!m.active && <span className="badge badge-neutral">disabled</span>}
            </span>
            <span className="muted">
              {m.permissions.length === ALL_PERMISSIONS.length ? "Full access" : `${m.permissions.length} permissions`}
            </span>
          </summary>
          <ActionForm action={saveManager} className="mt-3 flex flex-col gap-3">
            <ManagerFields sites={sites} m={m} />
          </ActionForm>
          <div className="mt-3">
            <ActionForm action={toggleManager} submitLabel={m.active ? "Disable login" : "Enable login"} submitClass={m.active ? "btn-danger" : "btn-secondary"}>
              <input type="hidden" name="id" value={m.id} />
            </ActionForm>
          </div>
        </details>
      ))}
    </div>
  );
}
