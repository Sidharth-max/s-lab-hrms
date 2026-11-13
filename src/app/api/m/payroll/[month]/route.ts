import { db } from "@/lib/db";
import { apiError, json, staff } from "@/lib/api";
import { can } from "@/lib/permissions";
import { employeeScope } from "@/lib/scope";
import { employedInMonthWhere } from "@/lib/services";
import { isMonthKey, istMonthKey } from "@/lib/time";

export async function GET(_req: Request, ctx: RouteContext<"/api/m/payroll/[month]">) {
  return staff(async (actor) => {
    const { month } = await ctx.params;
    if (!isMonthKey(month) || month > istMonthKey(new Date())) return apiError("Bad month");
    const run = await db.payrollRun.findUnique({ where: { businessId_month: { businessId: actor.businessId, month } } });
    const lines = run
      ? await db.payrollLine.findMany({ where: { runId: run.id, employee: employeeScope(actor) }, include: { employee: true }, orderBy: { employee: { name: "asc" } } })
      : [];
    const [employees, adjustments] = await Promise.all([
      db.employee.findMany({ where: { ...employeeScope(actor), ...employedInMonthWhere(actor.businessId, month) }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
      db.adjustment.findMany({ where: { month, employee: employeeScope(actor) }, include: { employee: true }, orderBy: { createdAt: "desc" } }),
    ]);
    return json({
      employees,
      adjustments: adjustments.map((a) => ({ id: a.id, employee: a.employee.name, amount: a.amount, reason: a.reason })),
      month,
      exists: !!run,
      locked: run?.status === "LOCKED",
      updatedAt: run?.updatedAt.toISOString() ?? null,
      canRun: can(actor, "payroll.run"),
      canLock: can(actor, "payroll.lock"),
      lines: lines.map((l) => ({
        id: l.id,
        employeeId: l.employeeId,
        name: l.employee.name,
        hold: l.employee.holdSalary,
        wageType: l.wageType,
        rate: l.rate,
        payableDays: l.payableDays,
        daysInMonth: l.daysInMonth,
        gross: l.gross,
        adjustments: l.adjustments,
        pf: l.pfEmployee,
        esi: l.esiEmployee,
        advance: l.advanceRecovered,
        net: l.net,
        paid: l.paidAmount,
        paymentMode: l.paymentMode,
      })),
    });
  });
}
