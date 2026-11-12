import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";

export default async function AuditPage() {
  const actor = await requireOwner();
  const { t } = await getT();
  const logs = await db.auditLog.findMany({ where: { businessId: actor.businessId }, orderBy: { createdAt: "desc" }, take: 300 });
  const users = new Map((await db.user.findMany({ where: { businessId: actor.businessId } })).map((u) => [u.id, u.name]));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">{t("History", "इतिहास")}</h1>
      <p className="muted">{t("Every change made by the owner and managers (latest 300).", "मालिक और मैनेजरों का हर बदलाव (आख़िरी 300)।")}</p>
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead><tr><th>{t("When", "कब")}</th><th>{t("Who", "किसने")}</th><th>{t("What", "क्या")}</th><th>{t("Details", "विवरण")}</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="card-title whitespace-nowrap">{l.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                <td data-label={t("Who", "किसने")}>{users.get(l.actorId ?? "") ?? t("System", "सिस्टम")}</td>
                <td data-label={t("What", "क्या")}>{l.action}</td>
                <td className="max-w-md break-all !text-left font-mono text-xs">{l.detail ? JSON.stringify(l.detail) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
