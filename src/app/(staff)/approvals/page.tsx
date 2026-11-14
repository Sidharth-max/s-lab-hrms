import { decideApproval, sendApprovalOtp, verifyApprovalOtp } from "@/app/actions/advances";
import { ActionForm } from "@/components/ActionForm";
import { PageHero, SectionTitle } from "@/components/PageHero";
import { BadgeCheck, CircleCheck, HandCoins, History } from "@/components/icons";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export default async function ApprovalsPage() {
  const actor = await requireStaff();
  const canDecide = can(actor, "approvals.decide");
  const [pending, recent] = await Promise.all([
    db.approvalRequest.findMany({ where: { businessId: actor.businessId, status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    db.approvalRequest.findMany({ where: { businessId: actor.businessId, status: { not: "PENDING" } }, orderBy: { decidedAt: "desc" }, take: 20 }),
  ]);
  const ids = [...new Set([...pending, ...recent].flatMap((r) => [r.requestedBy, r.decidedBy]).filter(Boolean) as string[])];
  const users = new Map((await db.user.findMany({ where: { id: { in: ids } } })).map((u) => [u.id, u.name]));

  return (
    <div className="flex flex-col gap-4">
      <PageHero
        icon={<BadgeCheck size={24} />}
        eyebrow="Approvals"
        title={pending.length ? `${pending.length} waiting` : "All clear"}
        subtitle="An advance that makes an employee's balance negative needs approval: here, or by an OTP sent to the owner's mobile."
        pills={[{ label: canDecide ? "You can approve" : "Needs the owner's OTP", tone: canDecide ? "ok" : undefined }]}
      />
      {pending.length === 0 && (
        <div className="card flex flex-col items-center gap-2 py-8 text-center">
          <span className="icon-badge !h-12 !w-12 bg-[var(--tint-green)] text-[var(--ink-green)]" aria-hidden><CircleCheck size={26} /></span>
          <p className="font-bold">Nothing waiting</p>
          <p className="muted">New requests show up here.</p>
        </div>
      )}
      {pending.map((r) => (
        <div key={r.id} className="card flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="icon-badge !h-10 !w-10 bg-[var(--tint-orange)] text-[var(--ink-orange)]" aria-hidden><HandCoins size={20} /></span>
            <div className="min-w-0">
            <div className="font-bold">{r.summary}</div>
            <div className="muted">
              {"Asked by"} {users.get(r.requestedBy) ?? "?"} · {r.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
            </div>
            </div>
          </div>
          {canDecide ? (
            <div className="flex flex-wrap gap-2">
              <ActionForm action={decideApproval} submitLabel={"Approve"}>
                <input type="hidden" name="approvalId" value={r.id} />
                <input type="hidden" name="decision" value="approve" />
              </ActionForm>
              <ActionForm action={decideApproval} submitLabel={"Reject"} submitClass="btn-danger" confirm={"Reject this advance?"}>
                <input type="hidden" name="approvalId" value={r.id} />
                <input type="hidden" name="decision" value="reject" />
              </ActionForm>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg bg-[var(--soft)] p-3">
              <p className="text-sm">{"Owner not here? Send an OTP to the owner's mobile and type the code they tell you."}</p>
              <ActionForm action={sendApprovalOtp} submitLabel={"Send OTP to owner"} submitClass="btn-secondary">
                <input type="hidden" name="approvalId" value={r.id} />
              </ActionForm>
              <ActionForm action={verifyApprovalOtp} className="flex flex-wrap items-center gap-2" submitLabel={"Approve with OTP"}>
                <input type="hidden" name="approvalId" value={r.id} />
                <input name="code" className="input max-w-[10rem] tracking-widest" inputMode="numeric" maxLength={6} placeholder={"6 digit OTP"} required />
              </ActionForm>
            </div>
          )}
        </div>
      ))}
      {recent.length > 0 && (
        <section className="card overflow-x-auto">
          <SectionTitle icon={<History size={18} />} ink="violet">Recently decided</SectionTitle>
          <table className="table table-cards">
            <thead><tr><th>Request</th><th>Decision</th><th>By</th><th>When</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="card-title">{r.summary}</td>
                  <td data-label={"Decision"}>{r.status === "APPROVED" ? "Approved" : "Rejected"}</td>
                  <td data-label={"By"}>{users.get(r.decidedBy ?? "") ?? "?"}</td>
                  <td data-label={"When"}>{r.decidedAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
