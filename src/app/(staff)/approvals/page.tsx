import { decideApproval, sendApprovalOtp, verifyApprovalOtp } from "@/app/actions/advances";
import { ActionForm } from "@/components/ActionForm";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { can } from "@/lib/permissions";

export default async function ApprovalsPage() {
  const actor = await requireStaff();
  const { t } = await getT();
  const canDecide = can(actor, "approvals.decide");
  const [pending, recent] = await Promise.all([
    db.approvalRequest.findMany({ where: { businessId: actor.businessId, status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    db.approvalRequest.findMany({ where: { businessId: actor.businessId, status: { not: "PENDING" } }, orderBy: { decidedAt: "desc" }, take: 20 }),
  ]);
  const ids = [...new Set([...pending, ...recent].flatMap((r) => [r.requestedBy, r.decidedBy]).filter(Boolean) as string[])];
  const users = new Map((await db.user.findMany({ where: { id: { in: ids } } })).map((u) => [u.id, u.name]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">{t("Approvals", "मंज़ूरी")}</h1>
      <p className="muted">
        {t(
          "An advance that makes an employee's balance negative needs the owner's approval: either here in the app, or by an OTP sent to the owner's mobile.",
          "जिस एडवांस से कर्मचारी का बैलेंस माइनस में जाए, उसके लिए मालिक की मंज़ूरी चाहिए: यहाँ ऐप में, या मालिक के मोबाइल पर भेजे गए OTP से।",
        )}
      </p>
      {pending.length === 0 && <div className="card muted">{t("Nothing waiting.", "कुछ बाकी नहीं।")}</div>}
      {pending.map((r) => (
        <div key={r.id} className="card flex flex-col gap-3">
          <div>
            <div className="font-semibold">{r.summary}</div>
            <div className="muted">
              {t("Asked by", "माँगा:")} {users.get(r.requestedBy) ?? "?"} · {r.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
            </div>
          </div>
          {canDecide ? (
            <div className="flex flex-wrap gap-2">
              <ActionForm action={decideApproval} submitLabel={t("Approve", "मंज़ूर करें")}>
                <input type="hidden" name="approvalId" value={r.id} />
                <input type="hidden" name="decision" value="approve" />
              </ActionForm>
              <ActionForm action={decideApproval} submitLabel={t("Reject", "नामंज़ूर करें")} submitClass="btn-danger" confirm={t("Reject this advance?", "यह एडवांस नामंज़ूर करें?")}>
                <input type="hidden" name="approvalId" value={r.id} />
                <input type="hidden" name="decision" value="reject" />
              </ActionForm>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
              <p className="text-sm">{t("Owner not here? Send an OTP to the owner's mobile and type the code they tell you.", "मालिक यहाँ नहीं हैं? उनके मोबाइल पर OTP भेजें और जो कोड वे बताएं वह डालें।")}</p>
              <ActionForm action={sendApprovalOtp} submitLabel={t("Send OTP to owner", "मालिक को OTP भेजें")} submitClass="btn-secondary">
                <input type="hidden" name="approvalId" value={r.id} />
              </ActionForm>
              <ActionForm action={verifyApprovalOtp} className="flex flex-wrap items-center gap-2" submitLabel={t("Approve with OTP", "OTP से मंज़ूर करें")}>
                <input type="hidden" name="approvalId" value={r.id} />
                <input name="code" className="input max-w-[10rem] tracking-widest" inputMode="numeric" maxLength={6} placeholder={t("6 digit OTP", "6 अंक का OTP")} required />
              </ActionForm>
            </div>
          )}
        </div>
      ))}
      {recent.length > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="mb-2 font-semibold">{t("Recently decided", "हाल के फ़ैसले")}</h2>
          <table className="table table-cards">
            <thead><tr><th>{t("Request", "अनुरोध")}</th><th>{t("Decision", "फ़ैसला")}</th><th>{t("By", "किसने")}</th><th>{t("When", "कब")}</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="card-title">{r.summary}</td>
                  <td data-label={t("Decision", "फ़ैसला")}>{r.status === "APPROVED" ? t("Approved", "मंज़ूर") : t("Rejected", "नामंज़ूर")}</td>
                  <td data-label={t("By", "किसने")}>{users.get(r.decidedBy ?? "") ?? "?"}</td>
                  <td data-label={t("When", "कब")}>{r.decidedAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
