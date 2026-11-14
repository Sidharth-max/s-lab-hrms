import { LeavePanel } from "@/components/LeavePanel";
import { PageHero } from "@/components/PageHero";
import { Beach } from "@/components/icons";
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
      <PageHero
        icon={<Beach size={24} />}
        eyebrow="Leave"
        title={rows.some((r) => r.state === "on_leave") ? `${rows.filter((r) => r.state === "on_leave").length} on leave now` : "Nobody on leave"}
        subtitle="Who is on leave now, upcoming leave, and the last 60 days."
        stats={[
          { label: "On leave", value: rows.filter((r) => r.state === "on_leave").length },
          { label: "Upcoming", value: rows.filter((r) => r.state === "upcoming").length },
          { label: "Finished", value: rows.filter((r) => r.state === "done").length },
        ]}
      />
      <LeavePanel rows={rows} people={people} canEdit={canEdit} />
    </div>
  );
}
