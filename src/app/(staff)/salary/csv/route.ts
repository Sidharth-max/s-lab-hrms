import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { hisaabFor } from "@/lib/ledger";
import { employeeScope } from "@/lib/scope";
import { parseShow, showWhere } from "@/lib/show-filter";
import { istDateKey } from "@/lib/time";

const rs = (paise: number) => (paise / 100).toFixed(2);
const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Everyone's salary balance as a spreadsheet. */
export async function GET(req: Request) {
  const actor = await requireStaff();
  const show = parseShow(new URL(req.url).searchParams.get("show"));
  const employees = await db.employee.findMany({ where: { ...employeeScope(actor), ...showWhere(show) }, orderBy: { name: "asc" } });
  const all = await hisaabFor(actor.businessId, employees);
  const lines = [["Code", "Name", "Joined", "Salary earned (gross)", "PF+ESIC", "Extra minus deductions", "Advances", "Paid", "Balance", "Last paid"].join(",")];
  for (const e of employees) {
    const h = all.get(e.id)!;
    lines.push([e.code, e.name, h.since, rs(h.gross), rs(h.pf + h.esi), rs(h.extras), rs(h.advances), rs(h.payments), rs(h.balance), h.lastPaidOn ?? ""].map((v) => cell(String(v))).join(","));
  }
  return new Response(lines.join("\n") + "\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="salary-${istDateKey(new Date())}.csv"` },
  });
}
