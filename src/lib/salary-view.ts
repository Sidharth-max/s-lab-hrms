import "server-only";
import { db } from "./db";
import { hisaabFor } from "./ledger";
import { istDateKey } from "./time";
import type { Actor } from "./permissions";
import { employeeScope } from "./scope";
import { showWhere, type ShowFilter } from "./show-filter";

/**
 * The Salary overview as ONE data model for the website (/salary) and the app (/api/m/salary).
 * Before, the web page and the app API each picked their own columns (the app showed only the
 * balance and last paid date, the web showed earned / advances / paid too), which is why the two
 * screens looked like different products. Both now show the same summary and the same row fields.
 */
export interface SalaryRow {
  employeeId: string;
  name: string;
  code: string;
  active: boolean;
  wageType: "MONTHLY" | "DAILY";
  wage: number;
  /** Salary earned plus extra pay minus deductions. */
  earned: number;
  advances: number;
  payments: number;
  balance: number;
  lastPaidOn: string | null;
  pendingAdvances: number;
}

export interface SalaryView {
  rows: SalaryRow[];
  toPay: number;
  owed: number;
  /** People with something to pay. */
  due: number;
  /** Salary paid out since the 1st of this month. */
  paidThisMonth: number;
  /** Advances given since the 1st of this month. */
  advancesThisMonth: number;
}

export async function buildSalaryView(actor: Actor, show: ShowFilter, q = ""): Promise<SalaryView> {
  const employees = await db.employee.findMany({
    where: { ...employeeScope(actor), ...showWhere(show), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}) },
    orderBy: { name: "asc" },
  });
  const all = await hisaabFor(actor.businessId, employees);
  const monthStart = `${istDateKey(new Date()).slice(0, 7)}-01`;
  let paidThisMonth = 0;
  let advancesThisMonth = 0;
  const rows: SalaryRow[] = employees.map((e) => {
    const h = all.get(e.id)!;
    for (const x of h.entries) {
      if (x.pending || x.date < monthStart) continue;
      if (x.kind === "payment") paidThisMonth += x.amount;
      if (x.kind === "advance") advancesThisMonth += x.amount;
    }
    return {
      employeeId: e.id,
      name: e.name,
      code: e.code,
      active: e.active,
      wageType: e.wageType,
      wage: e.wageType === "MONTHLY" ? e.monthlyWage : e.dailyWage,
      earned: h.earned + h.extras,
      advances: h.advances,
      payments: h.payments,
      balance: h.balance,
      lastPaidOn: h.lastPaidOn,
      pendingAdvances: h.pendingAdvances,
    };
  });
  return {
    rows,
    toPay: rows.reduce((s, r) => s + Math.max(0, r.balance), 0),
    owed: rows.reduce((s, r) => s + Math.max(0, -r.balance), 0),
    due: rows.filter((r) => r.balance > 0).length,
    paidThisMonth,
    advancesThisMonth,
  };
}
