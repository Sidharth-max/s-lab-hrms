import Link from "next/link";
import { createEmployee } from "@/app/actions/employees";
import { ActionForm } from "@/components/ActionForm";
import { EmployeeFields } from "@/components/EmployeeFields";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { siteWhere } from "@/lib/scope";
import { istDateKey } from "@/lib/time";
import { getT } from "@/lib/i18n-server";

export default async function NewEmployee() {
  const actor = await requireStaff("employees.manage");
  const { t } = await getT();
  const sites = await db.site.findMany({ where: { ...siteWhere(actor), active: true }, orderBy: { name: "asc" } });
  const count = await db.employee.count({ where: { businessId: actor.businessId } });
  if (sites.length === 0) {
    return (
      <div className="card">
        {t("Add a site first in", "पहले साइट जोड़ें:")} <Link className="underline" href="/settings">{t("Settings", "सेटिंग")}</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">{t("Add employee", "कर्मचारी जोड़ें")}</h1>
      <ActionForm action={createEmployee} className="card flex flex-col gap-4" submitLabel={t("Add employee", "कर्मचारी जोड़ें")}>
        <EmployeeFields
          sites={sites}
          isNew
          canSalary={can(actor, "salary.edit")}
          values={{ joinedOn: istDateKey(new Date()), code: `E${String(count + 1).padStart(3, "0")}` }}
        />
      </ActionForm>
      <p className="muted">{t("After saving, enroll the face on the next screen.", "सेव करने के बाद अगली स्क्रीन पर चेहरा दर्ज करें।")}</p>
    </div>
  );
}
