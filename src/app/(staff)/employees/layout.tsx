import { EmployeeList } from "@/components/EmployeeList";
import { SplitView } from "@/components/SplitView";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { formatRs } from "@/lib/money";
import { can } from "@/lib/permissions";
import { employeeScope } from "@/lib/scope";

export default async function EmployeesLayout({ children }: LayoutProps<"/employees">) {
  const actor = await requireStaff();
  const { t } = await getT();
  const employees = await db.employee.findMany({ where: employeeScope(actor), include: { site: true }, orderBy: { name: "asc" } });
  const rows = employees.map((e) => ({
    id: e.id,
    name: e.name,
    code: e.code,
    phone: e.phone,
    site: e.site.name,
    wage: e.wageType === "MONTHLY" ? `${formatRs(e.monthlyWage)} ${t("/ month", "/ महीना")}` : `${formatRs(e.dailyWage)} ${t("/ day", "/ दिन")}`,
    active: e.active,
    face: !!e.faceId,
  }));
  return (
    <SplitView base="/employees" list={<EmployeeList rows={rows} canAdd={can(actor, "employees.manage")} />}>
      {children}
    </SplitView>
  );
}
