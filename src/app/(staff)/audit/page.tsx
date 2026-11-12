import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AuditPage() {
  const actor = await requireOwner();
  const logs = await db.auditLog.findMany({ where: { businessId: actor.businessId }, orderBy: { createdAt: "desc" }, take: 300 });
  const users = new Map((await db.user.findMany({ where: { businessId: actor.businessId } })).map((u) => [u.id, u.name]));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">History</h1>
      <p className="muted">Every change made by the owner and managers (latest 300).</p>
      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{l.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                <td>{users.get(l.actorId ?? "") ?? "System"}</td>
                <td>{l.action}</td>
                <td className="max-w-md break-all font-mono text-xs">{l.detail ? JSON.stringify(l.detail) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
