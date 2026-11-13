import { db } from "@/lib/db";
import { json, staff } from "@/lib/api";
import { hisaabFor } from "@/lib/ledger";
import { employeeScope } from "@/lib/scope";
import { parseShow, showWhere } from "@/lib/show-filter";

// Everyone's salary balance for the app's Salary screen.
export async function GET(req: Request) {
  return staff(async (actor) => {
    const show = parseShow(new URL(req.url).searchParams.get("show"));
    const employees = await db.employee.findMany({ where: { ...employeeScope(actor), ...showWhere(show) }, orderBy: { name: "asc" } });
    const all = await hisaabFor(actor.businessId, employees);
    const rows = employees.map((e) => {
      const h = all.get(e.id)!;
      return { employeeId: e.id, name: e.name, code: e.code, active: e.active, earned: h.earned + h.extras, advances: h.advances, payments: h.payments, balance: h.balance, lastPaidOn: h.lastPaidOn };
    });
    return json({
      rows,
      toPay: rows.reduce((s, r) => s + Math.max(0, r.balance), 0),
      owed: rows.reduce((s, r) => s + Math.max(0, -r.balance), 0),
    });
  });
}
