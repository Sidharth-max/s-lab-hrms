import { db } from "@/lib/db";
import { parseDayRules } from "@/lib/day-rules";
import { json, staff } from "@/lib/api";
import { dbToDateKey } from "@/lib/time";

export async function GET() {
  return staff(async (actor) => {
    const [b, sites, holidays] = await Promise.all([
      db.business.findUniqueOrThrow({ where: { id: actor.businessId } }),
      db.site.findMany({ where: { businessId: actor.businessId }, orderBy: { name: "asc" } }),
      db.holiday.findMany({ where: { businessId: actor.businessId }, orderBy: { date: "desc" }, take: 60 }),
    ]);
    return json({
      name: b.name,
      weeklyOffDays: b.weeklyOffDays,
      dayRules: parseDayRules(b.dayRules),
      duplicateScanMins: b.duplicateScanMins,
      maxShiftHours: b.maxShiftHours,
      pfEmployeePct: b.pfEmployeeBps / 100,
      pfEmployerPct: b.pfEmployerBps / 100,
      pfWageCeiling: b.pfWageCeiling / 100,
      esiEmployeePct: b.esiEmployeeBps / 100,
      esiEmployerPct: b.esiEmployerBps / 100,
      sites: sites.map((s) => ({ id: s.id, name: s.name, active: s.active })),
      holidays: holidays.map((h) => ({ id: h.id, date: dbToDateKey(h.date), name: h.name })),
    });
  }, "settings.manage");
}
