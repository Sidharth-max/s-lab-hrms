import { db } from "@/lib/db";
import { apiError, json, staff } from "@/lib/api";
import { employeeScope } from "@/lib/scope";
import { recoveredByAdvance } from "@/lib/services";
import { dbToDateKey } from "@/lib/time";

// One advance, for the app's edit screen (editing itself is owner-only, checked by the action).
export async function GET(_req: Request, ctx: RouteContext<"/api/m/advances/[id]">) {
  const { id } = await ctx.params;
  return staff(async (actor) => {
    const a = await db.advance.findFirst({ where: { id, employee: employeeScope(actor) }, include: { employee: true } });
    if (!a) return apiError("Advance not found", 404);
    const recovered = (await recoveredByAdvance([a.id])).get(a.id) ?? 0;
    return json({
      advance: {
        id: a.id,
        employeeId: a.employeeId,
        employee: a.employee.name,
        code: a.employee.code,
        amount: a.amount,
        givenOn: dbToDateKey(a.givenOn),
        recoveryMonths: a.recoveryMonths,
        startMonth: a.startMonth,
        note: a.note,
        status: a.status,
        recovered,
        remaining: a.amount - recovered,
      },
      canEdit: actor.role === "OWNER" && (a.status === "ACTIVE" || a.status === "CLEARED"),
    });
  });
}
