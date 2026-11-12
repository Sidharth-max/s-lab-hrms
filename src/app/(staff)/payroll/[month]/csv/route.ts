import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { employeeScope } from "@/lib/scope";
import { isMonthKey } from "@/lib/time";

function cell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const rs = (p: number) => (p / 100).toFixed(2);

export async function GET(_req: Request, ctx: RouteContext<"/payroll/[month]/csv">) {
  const actor = await getActor();
  if (!actor || actor.role === "EMPLOYEE") return new NextResponse("Not signed in", { status: 401 });
  const { month } = await ctx.params;
  if (!isMonthKey(month)) return new NextResponse("Bad month", { status: 400 });
  const run = await db.payrollRun.findUnique({ where: { businessId_month: { businessId: actor.businessId, month } } });
  if (!run) return new NextResponse("Not found", { status: 404 });
  const lines = await db.payrollLine.findMany({
    where: { runId: run.id, employee: employeeScope(actor) },
    include: { employee: { include: { site: true } } },
    orderBy: { employee: { name: "asc" } },
  });
  const header = ["Code", "Name", "Site", "Type", "Rate", "Days in month", "Present days", "Paid off days", "Payable days", "Gross", "Adjustments", "PF employee", "ESIC employee", "Advance recovered", "Net", "PF employer", "ESIC employer", "Paid", "Paid on", "Mode", "Reference"];
  const rows = lines.map((l) => [
    l.employee.code, l.employee.name, l.employee.site.name, l.wageType, rs(l.rate), l.daysInMonth, l.presentDays, l.paidOffDays, l.payableDays,
    rs(l.gross), rs(l.adjustments), rs(l.pfEmployee), rs(l.esiEmployee), rs(l.advanceRecovered), rs(l.net), rs(l.pfEmployer), rs(l.esiEmployer),
    rs(l.paidAmount), l.paidOn ? l.paidOn.toISOString().slice(0, 10) : "", l.paymentMode ?? "", l.paymentRef ?? "",
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="salary-${month}.csv"` },
  });
}
