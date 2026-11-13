import Link from "next/link";
import { createEmployee } from "@/app/actions/employees";
import { ActionForm } from "@/components/ActionForm";
import { EmployeeFields } from "@/components/EmployeeFields";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { siteWhere } from "@/lib/scope";
import { istDateKey } from "@/lib/time";
import { nextEmployeeCode } from "@/lib/services";

export default async function NewEmployee() {
  const actor = await requireStaff("employees.manage");
  const sites = await db.site.findMany({ where: { ...siteWhere(actor), active: true }, orderBy: { name: "asc" } });
  const code = await nextEmployeeCode(actor.businessId);
  const business = await db.business.findUniqueOrThrow({ where: { id: actor.businessId } });
  if (sites.length === 0) {
    return (
      <div className="card">
        {"Add a site first in"} <Link className="underline" href="/settings">Settings</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Add employee</h1>
      <ActionForm action={createEmployee} className="card flex flex-col gap-4" submitLabel={"Add employee"}>
        <EmployeeFields
          sites={sites}
          isNew
          canSalary={can(actor, "salary.edit")}
          businessWeeklyOff={business.weeklyOffDays}
          values={{ joinedOn: istDateKey(new Date()), code }}
        />
      </ActionForm>
      <p className="muted">After saving, enroll the face on the next screen.</p>
    </div>
  );
}
