import { createEmployeeCore } from "@/app/actions/employees";
import { db } from "@/lib/db";
import { actionResponse, json, readJson, staff, toForm } from "@/lib/api";
import { employeeScope } from "@/lib/scope";
import { nextEmployeeCode } from "@/lib/services";

export async function GET() {
  return staff(async (actor) => {
    const employees = await db.employee.findMany({ where: employeeScope(actor), include: { site: true }, orderBy: { name: "asc" } });
    return json({
      nextCode: await nextEmployeeCode(actor.businessId),
      employees: employees.map((e) => ({
        id: e.id,
        name: e.name,
        code: e.code,
        phone: e.phone,
        site: e.site.name,
        active: e.active,
        wageType: e.wageType,
        wage: e.wageType === "MONTHLY" ? e.monthlyWage : e.dailyWage,
        face: !!e.faceId,
      })),
    });
  });
}

/** Add an employee. Body: name, code, phone?, siteId, joinedOn, wageType, wage (rupees), basicPercent?, pfEnabled?, esiEnabled?, weeklyOffMode?, empWeeklyOff? */
export async function POST(req: Request) {
  return staff(async () => actionResponse(await createEmployeeCore(null, toForm(await readJson(req)))), "employees.manage");
}
