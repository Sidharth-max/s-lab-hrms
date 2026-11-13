import { notFound } from "next/navigation";
import { updateEmployeeAndReturn } from "@/app/actions/employees";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { BackLink } from "@/components/BackLink";
import { EmployeeFields } from "@/components/EmployeeFields";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { rsInput } from "@/lib/money";
import { can, canSeeSite } from "@/lib/permissions";
import { siteWhere } from "@/lib/scope";
import { dbToDateKey } from "@/lib/time";

export default async function EditEmployeePage({ params }: PageProps<"/employees/[id]/edit">) {
  const actor = await requireStaff("employees.manage");
  const { id } = await params;
  const emp = await db.employee.findFirst({ where: { id, businessId: actor.businessId } });
  if (!emp || !canSeeSite(actor, emp.siteId)) notFound();
  const [business, sites] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
    db.site.findMany({ where: siteWhere(actor), orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <BackLink href={`/employees/${emp.id}`} label={emp.name} />
        <div className="mt-1 flex items-center gap-3">
          <Avatar name={emp.name} size={40} />
          <div>
            <h1 className="h1">Edit employee</h1>
            <p className="muted">{emp.name} · {emp.code}</p>
          </div>
        </div>
      </div>
      <ActionForm action={updateEmployeeAndReturn} className="card flex flex-col gap-5" submitLabel="Save changes">
        <input type="hidden" name="id" value={emp.id} />
        <EmployeeFields
          sites={sites}
          isNew={false}
          canSalary={can(actor, "salary.edit")}
          businessWeeklyOff={business.weeklyOffDays}
          values={{
            name: emp.name,
            code: emp.code,
            phone: emp.phone,
            siteId: emp.siteId,
            joinedOn: dbToDateKey(emp.joinedOn),
            wageType: emp.wageType,
            wage: rsInput(emp.wageType === "MONTHLY" ? emp.monthlyWage : emp.dailyWage),
            basicPercent: emp.basicPercent,
            pfEnabled: emp.pfEnabled,
            esiEnabled: emp.esiEnabled,
            customWeeklyOff: emp.customWeeklyOff,
            weeklyOffDays: emp.weeklyOffDays,
          }}
        />
      </ActionForm>
    </div>
  );
}
