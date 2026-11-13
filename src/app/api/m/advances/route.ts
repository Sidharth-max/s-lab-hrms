import { db } from "@/lib/db";
import { json, staff } from "@/lib/api";
import { employeeScope } from "@/lib/scope";
import { dbToDateKey } from "@/lib/time";

export async function GET() {
  return staff(async (actor) => {
    const advances = await db.advance.findMany({
      where: { employee: employeeScope(actor), status: { in: ["ACTIVE", "CLEARED", "PENDING_APPROVAL"] } },
      include: { employee: true },
      orderBy: { givenOn: "desc" },
      take: 500,
    });
    return json({
      advances: advances.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employee: a.employee.name,
        givenOn: dbToDateKey(a.givenOn),
        amount: a.amount,
        note: a.note,
        status: a.status === "CLEARED" ? "ACTIVE" : a.status,
      })),
    });
  });
}
