import { LeavePanel } from "@/components/LeavePanel";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { listLeaves } from "@/lib/leaves";
import { can } from "@/lib/permissions";
import { employeeScope } from "@/lib/scope";

export default async function LeavesPage() {
  const actor = await requireStaff();
  const canEdit = can(actor, "attendance.edit");
  const [rows, people] = await Promise.all([
    listLeaves(actor),
    canEdit ? db.employee.findMany({ where: employeeScope(actor, { active: true }), orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }) : Promise.resolve([]),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="h1">Leave</h1>
        <p className="muted">Who is on leave now, upcoming leave, and the last 60 days.</p>
      </div>
      <LeavePanel rows={rows} people={people} canEdit={canEdit} />
    </div>
  );
}
