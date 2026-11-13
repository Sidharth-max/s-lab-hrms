import { db } from "@/lib/db";
import { apiError, json, staff } from "@/lib/api";
import { canSeeSite } from "@/lib/permissions";
import { employeeBalance, outstandingAdvances, todayStatus } from "@/lib/services";
import { dbToDateKey } from "@/lib/time";

export async function GET(_req: Request, ctx: RouteContext<"/api/m/employees/[id]">) {
  return staff(async (actor) => {
    const { id } = await ctx.params;
    const e = await db.employee.findFirst({ where: { id, businessId: actor.businessId }, include: { site: true, user: true } });
    if (!e || !canSeeSite(actor, e.siteId)) return apiError("Employee not found", 404);
    const [advances, pending, balance, lines, today] = await Promise.all([
      outstandingAdvances(e.id),
      db.advance.count({ where: { employeeId: e.id, status: "PENDING_APPROVAL" } }),
      employeeBalance(e),
      db.payrollLine.findMany({ where: { employeeId: e.id }, include: { run: true }, orderBy: { run: { month: "desc" } }, take: 12 }),
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
        faceEnrolledAt: e.faceEnrolledAt?.toISOString() ?? null,
        webLogin: !!e.user?.active,
      },
      balance,
      today,
      pendingAdvances: pending,
      advances: advances
        .filter((a) => a.remaining > 0)
        .map((a) => ({ id: a.id, givenOn: dbToDateKey(a.givenOn), amount: a.amount, recovered: a.recovered, remaining: a.remaining, recoveryMonths: a.recoveryMonths, startMonth: a.startMonth, note: a.note })),
      salary: lines.map((l) => ({ id: l.id, month: l.run.month, locked: l.run.status === "LOCKED", payableDays: l.payableDays, gross: l.gross, net: l.net, paid: l.paidAmount })),
    });
  });
}
