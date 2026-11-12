import Link from "next/link";
import { forgetThisDevice, registerDevice, revokeDevice } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { getDevice, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { siteWhere } from "@/lib/scope";

export default async function DevicesPage() {
  const actor = await requireStaff("devices.register");
  const [devices, sites, current] = await Promise.all([
    db.device.findMany({ where: { businessId: actor.businessId }, include: { site: true }, orderBy: { createdAt: "desc" } }),
    db.site.findMany({ where: { ...siteWhere(actor), active: true }, orderBy: { name: "asc" } }),
    getDevice(),
  ]);
  const users = new Map((await db.user.findMany({ where: { id: { in: devices.map((d) => d.registeredBy) } } })).map((u) => [u.id, u.name]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Scanner devices</h1>
      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">This device</h2>
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
                <select name="siteId" className="input" required>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
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
                <td className="card-title">{d.name}{current?.id === d.id && <span className="badge badge-neutral ml-1">this device</span>}</td>
                <td data-label={"Site"}>{d.site.name}</td>
                <td data-label={"Registered by"}>{users.get(d.registeredBy) ?? "?"} · {d.createdAt.toLocaleDateString("en-IN")}</td>
                <td data-label={"Last scan"}>{d.lastSeenAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "—"}</td>
                <td>
                  {d.revokedAt ? "Removed" : (
                    <ActionForm action={revokeDevice} submitLabel={"Remove"} submitClass="btn-danger !py-1" confirm={"Remove this scanner? It will stop working immediately."}>
                      <input type="hidden" name="deviceId" value={d.id} />
                    </ActionForm>
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
