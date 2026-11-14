import Link from "next/link";
import { PageHero, SectionTitle } from "@/components/PageHero";
import { ScanFace, Smartphone } from "@/components/icons";
import { forgetThisDevice, registerDevice, renameDevice, revokeDevice } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { getDevice, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { siteWhere } from "@/lib/scope";
import { Select } from "@/components/controls";

export default async function DevicesPage() {
  const actor = await requireStaff("devices.register");
  const [devices, sites, current] = await Promise.all([
    db.device.findMany({ where: { businessId: actor.businessId }, include: { site: true }, orderBy: [{ revokedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }] }),
    db.site.findMany({ where: { ...siteWhere(actor), active: true }, orderBy: { name: "asc" } }),
    getDevice(),
  ]);
  const users = new Map((await db.user.findMany({ where: { id: { in: devices.map((d) => d.registeredBy) } } })).map((u) => [u.id, u.name]));

  return (
    <div className="flex flex-col gap-4">
      <PageHero
        icon={<Smartphone size={24} />}
        eyebrow="Scanner devices"
        title={`${devices.filter((d) => !d.revokedAt).length} active scanner${devices.filter((d) => !d.revokedAt).length === 1 ? "" : "s"}`}
        subtitle="Phones and tablets that take face attendance."
        stats={[{ label: "Active", value: devices.filter((d) => !d.revokedAt).length }, { label: "Removed", value: devices.filter((d) => d.revokedAt).length }]}
      />
      <section className="card flex flex-col gap-3">
        <SectionTitle icon={<ScanFace size={18} />} ink="blue">This device</SectionTitle>
        {current ? (
          <div className="flex flex-wrap items-center gap-3">
            <span>{"Registered as"} <b>{current.name}</b> ({current.site.name}).</span>
            <Link href="/scan" className="btn-primary">Open face scan</Link>
            <form action={forgetThisDevice}><button className="btn-secondary">Stop using as scanner</button></form>
          </div>
        ) : (
          <>
            <p className="muted">
              {"Make this phone / tablet the attendance scanner for a site. Workers will then only see the face scan screen."}
            </p>
            <ActionForm action={registerDevice} className="grid gap-3 @2xl:grid-cols-2" submitLabel={"Make this device a scanner"}>
              <div>
                <label className="label">Site</label>
                <Select name="siteId" options={sites.map((s) => ({ value: s.id, label: s.name }))} ariaLabel="Site" />
              </div>
              <div>
                <label className="label">Name</label>
                <input name="name" className="input" placeholder={"e.g. Gate tablet"} />
              </div>
              <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="logout" defaultChecked /> {"Log me out and open scanner"}</label>
            </ActionForm>
          </>
        )}
      </section>
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr><th>Name</th><th>Site</th><th>Registered by</th><th>Last scan</th><th /></tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className={d.revokedAt ? "text-[var(--muted)]" : ""}>
                <td className="card-title">
                  <span className={`icon-badge mr-2 !h-8 !w-8 align-middle ${d.revokedAt ? "bg-[var(--tint-red)] text-[var(--ink-red)]" : "bg-[var(--tint-blue)] text-[var(--ink-blue)]"}`} aria-hidden><Smartphone size={16} /></span>
                  {d.name}{current?.id === d.id && <span className="badge badge-neutral ml-1">this device</span>}
                  {d.model && <div className="muted text-xs font-normal">{d.model}</div>}
                </td>
                <td data-label={"Site"}>{d.site.name}</td>
                <td data-label={"Registered by"}>{users.get(d.registeredBy) ?? "?"} · {d.createdAt.toLocaleDateString("en-IN")}</td>
                <td data-label={"Last scan"}>{d.lastSeenAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "—"}</td>
                <td>
                  {d.revokedAt ? "Removed" : (
                    <div className="flex flex-wrap items-center gap-2">
                    <details>
                      <summary className="btn-secondary !py-1 cursor-pointer">Rename</summary>
                      <ActionForm action={renameDevice} className="mt-2 flex flex-col gap-2" submitLabel="Save">
                        <input type="hidden" name="deviceId" value={d.id} />
                        <input name="name" className="input" defaultValue={d.name} required maxLength={60} />
                        <Select name="siteId" defaultValue={d.siteId} options={sites.map((s) => ({ value: s.id, label: s.name }))} ariaLabel="Site" />
                      </ActionForm>
                    </details>
                    <ActionForm action={revokeDevice} submitLabel={"Remove"} submitClass="btn-danger !py-1" confirm={"Remove this scanner? It will stop working immediately."}>
                      <input type="hidden" name="deviceId" value={d.id} />
                    </ActionForm>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {devices.length === 0 && <tr><td colSpan={5} className="muted">No scanners yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
