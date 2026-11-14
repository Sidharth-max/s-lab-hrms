import { db } from "@/lib/db";
import { json, staff } from "@/lib/api";
import { parseDayRules } from "@/lib/day-rules";

// Active shifts: for the shift picker on the employee form and the shift list in Settings.
export async function GET() {
  return staff(async (actor) => {
    const shifts = await db.shift.findMany({
      where: { businessId: actor.businessId, active: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: { where: { active: true } } } } },
    });
    return json({
      shifts: shifts.map((s) => ({ id: s.id, name: s.name, dayRules: parseDayRules(s.dayRules), weeklyOffDays: s.weeklyOffDays, staff: s._count.employees })),
    });
  });
}
