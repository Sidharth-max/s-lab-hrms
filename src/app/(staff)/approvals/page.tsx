import { decideApproval, sendApprovalOtp, verifyApprovalOtp } from "@/app/actions/advances";
import { ActionForm } from "@/components/ActionForm";
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
      <h1 className="h1">Approvals</h1>
      <p className="muted">
        {"An advance that makes an employee's balance negative needs approval by the owner or a manager allowed to approve (Managers > Advances > Approve advances): here, or by an OTP sent to the owner's mobile."}
      </p>
      {pending.length === 0 && <div className="card muted">Nothing waiting.</div>}
      {pending.map((r) => (
        <div key={r.id} className="card flex flex-col gap-3">
          <div>
            <div className="font-semibold">{r.summary}</div>
            <div className="muted">
              {"Asked by"} {users.get(r.requestedBy) ?? "?"} · {r.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
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
            <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
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
          <h2 className="mb-2 font-semibold">Recently decided</h2>
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
