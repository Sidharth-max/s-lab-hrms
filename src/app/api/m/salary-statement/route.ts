import { db } from "@/lib/db";
import { apiError, staff } from "@/lib/api";
import { can, canSeeSite } from "@/lib/permissions";
import { checkRange, salaryStatement } from "@/lib/statement";
import { statementPdf } from "@/lib/statement-pdf";
import { statementXlsx } from "@/lib/statement-xlsx";

// One employee's salary statement for a date range, as a PDF or Excel file.
// GET ?employeeId=…&from=YYYY-MM-DD&to=YYYY-MM-DD&format=pdf|xlsx
// Used by the website (cookie) and the Android app (Bearer token).
export async function GET(req: Request) {
  return staff(async (actor) => {
    const q = new URL(req.url).searchParams;
    const range = checkRange(q.get("from"), q.get("to"));
    if ("error" in range) return apiError(range.error);
    const format = q.get("format") === "xlsx" ? "xlsx" : "pdf";
    const emp = await db.employee.findFirst({ where: { id: q.get("employeeId") ?? "", businessId: actor.businessId }, select: { id: true, siteId: true, code: true, name: true } });
    if (!emp || !canSeeSite(actor, emp.siteId)) return apiError("Employee not found", 404);
    const s = await salaryStatement(actor.businessId, emp.id, range.from, range.to, can(actor, "salary.edit"));
    const safeName = `${emp.code}-${emp.name}`.replace(/[^A-Za-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const filename = `salary-${safeName}-${range.from}-to-${range.to}.${format}`;
    const body = format === "pdf" ? await statementPdf(s) : await statementXlsx(s);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }, "payroll.run");
}
