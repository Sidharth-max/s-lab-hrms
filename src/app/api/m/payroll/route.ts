import { db } from "@/lib/db";
import { json, staff } from "@/lib/api";

export async function GET() {
  return staff(async (actor) => {
    const runs = await db.payrollRun.findMany({
      where: { businessId: actor.businessId },
      include: { lines: { select: { net: true, paidAmount: true } } },
      orderBy: { month: "desc" },
    });
    return json({
      runs: runs.map((r) => ({
        month: r.month,
        locked: r.status === "LOCKED",
        employees: r.lines.length,
        net: r.lines.reduce((s, l) => s + l.net, 0),
        paid: r.lines.reduce((s, l) => s + l.paidAmount, 0),
      })),
    });
  });
}
