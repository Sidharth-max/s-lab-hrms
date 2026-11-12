import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { can } from "@/lib/permissions";
import { employeeScope } from "@/lib/scope";

export default async function EmployeesPage({ searchParams }: PageProps<"/employees">) {
  const actor = await requireStaff();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const showLeft = sp.left === "1";
  const employees = await db.employee.findMany({
    where: employeeScope(actor, {
      active: showLeft ? false : true,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
    }),
    include: { site: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Employees</h1>
        {can(actor, "employees.manage") && <Link href="/employees/new" className="btn-primary">+ Add employee</Link>}
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, code or mobile" className="input max-w-xs" />
        <select name="left" defaultValue={showLeft ? "1" : ""} className="input max-w-[10rem]">
          <option value="">Working</option>
          <option value="1">Left</option>
        </select>
        <button className="btn-secondary">Search</button>
      </form>
      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Code</th><th>Site</th><th>Wage</th><th>PF</th><th>ESIC</th><th>Face</th></tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td><Link href={`/employees/${e.id}`} className="font-medium text-[var(--brand)]">{e.name}</Link></td>
                <td>{e.code}</td>
                <td>{e.site.name}</td>
                <td>{e.wageType === "MONTHLY" ? `${formatRs(e.monthlyWage)} / month` : `${formatRs(e.dailyWage)} / day`}</td>
                <td>{e.pfEnabled ? "On" : "Off"}</td>
                <td>{e.esiEnabled ? "On" : "Off"}</td>
                <td>{e.faceId ? <span className="badge bg-green-100 text-green-800">Enrolled</span> : <span className="badge bg-amber-100 text-amber-800">Missing</span>}</td>
              </tr>
            ))}
            {employees.length === 0 && <tr><td colSpan={7} className="muted">No employees found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
