import { db } from "@/lib/db";
import { apiError, json, staff } from "@/lib/api";
import { canSeeSite } from "@/lib/permissions";

export async function GET(_req: Request, ctx: RouteContext<"/api/m/payslip/[lineId]">) {
  return staff(async (actor) => {
    const { lineId } = await ctx.params;
    const l = await db.payrollLine.findFirst({
      where: { id: lineId, run: { businessId: actor.businessId } },
      include: { run: true, employee: { include: { site: true, business: true } } },
    });
    if (!l || !canSeeSite(actor, l.employee.siteId)) return apiError("Payslip not found", 404);
    return json({
      business: l.employee.business.name,
      month: l.run.month,
      locked: l.run.status === "LOCKED",
      employee: { name: l.employee.name, code: l.employee.code, site: l.employee.site.name, uanNumber: l.employee.uanNumber, esicNumber: l.employee.esicNumber },
      wageType: l.wageType,
      rate: l.rate,
      daysInMonth: l.daysInMonth,
      presentDays: l.presentDays,
      payableDays: l.payableDays,
      gross: l.gross,
      adjustments: l.adjustments,
      pf: l.pfEmployee,
      esi: l.esiEmployee,
      pfEmployer: l.pfEmployer,
      esiEmployer: l.esiEmployer,
      advance: l.advanceRecovered,
      net: l.net,
      paid: l.paidAmount,
      paidOn: l.paidOn?.toISOString().slice(0, 10) ?? null,
      paymentMode: l.paymentMode,
      paymentRef: l.paymentRef,
    });
  });
}
