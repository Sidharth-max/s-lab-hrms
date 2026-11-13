import { db } from "@/lib/db";
import { json, staff } from "@/lib/api";
import { employeeScope } from "@/lib/scope";
import { recoveredByAdvance } from "@/lib/services";
import { dbToDateKey } from "@/lib/time";

export async function GET() {
  return staff(async (actor) => {
    const advances = await db.advance.findMany({
      where: { employee: employeeScope(actor), status: { in: ["ACTIVE", "PENDING_APPROVAL"] } },
      include: { employee: true },
      orderBy: { givenOn: "desc" },
      take: 500,
    });
    const rec = await recoveredByAdvance(advances.map((a) => a.id));
    return json({
      advances: advances.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employee: a.employee.name,
        givenOn: dbToDateKey(a.givenOn),
        amount: a.amount,
        recovered: rec.get(a.id) ?? 0,
        remaining: a.amount - (rec.get(a.id) ?? 0),
        recoveryMonths: a.recoveryMonths,
        startMonth: a.startMonth,
        status: a.status,
      })),
    });
  });
}
