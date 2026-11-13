import { db } from "@/lib/db";
import { apiError, json, staff } from "@/lib/api";
import { can, canSeeSite } from "@/lib/permissions";
import { todayStatus } from "@/lib/services";
import { hisaabOf } from "@/lib/ledger";
import { dbToDateKey } from "@/lib/time";

export async function GET(_req: Request, ctx: RouteContext<"/api/m/employees/[id]">) {
  return staff(async (actor) => {
    const { id } = await ctx.params;
    const e = await db.employee.findFirst({ where: { id, businessId: actor.businessId }, include: { site: true, user: true } });
    if (!e || !canSeeSite(actor, e.siteId)) return apiError("Employee not found", 404);
    const [hisaab, wages, today] = await Promise.all([
      hisaabOf(e),
      db.wageChange.findMany({ where: { employeeId: e.id }, orderBy: { effectiveFrom: "desc" } }),
      e.active ? todayStatus(e) : Promise.resolve(null),
    ]);
    return json({
      employee: {
        id: e.id,
        name: e.name,
        code: e.code,
        phone: e.phone,
        siteId: e.siteId,
        site: e.site.name,
        joinedOn: dbToDateKey(e.joinedOn),
        leftOn: e.leftOn ? dbToDateKey(e.leftOn) : null,
        active: e.active,
        wageType: e.wageType,
        wage: e.wageType === "MONTHLY" ? e.monthlyWage : e.dailyWage,
        basicPercent: e.basicPercent,
        pfEnabled: e.pfEnabled,
        esiEnabled: e.esiEnabled,
        uanNumber: e.uanNumber,
        esicNumber: e.esicNumber,
        customWeeklyOff: e.customWeeklyOff,
        weeklyOffDays: e.weeklyOffDays,
        face: !!e.faceId,
        inHouse: e.inHouse,
        faceEnrolledAt: e.faceEnrolledAt?.toISOString() ?? null,
        webLogin: !!e.user?.active,
      },
      today,
      // One running salary balance (no salary months). See lib/ledger.ts.
      hisaab,
      wages: wages.map((w) => ({ from: dbToDateKey(w.effectiveFrom), wageType: w.wageType, wage: w.wageType === "MONTHLY" ? w.monthlyWage : w.dailyWage })),
      can: {
        pay: can(actor, "payroll.lock"),
        extras: can(actor, "payroll.run"),
        advance: can(actor, "advances.manage"),
        owner: actor.role === "OWNER",
      },
    });
  });
}
