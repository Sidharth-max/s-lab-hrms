import { DateInput } from "@/components/controls";
import { Download } from "@/components/icons";
import { SectionTitle } from "@/components/PageHero";

/**
 * Download one employee's salary statement for a date range: every day's attendance (status,
 * clock in / out, late, left early) and the salary breakdown, as a PDF or an Excel file.
 */
export function SalaryExport({ employeeId, from, to, min }: { employeeId: string; from: string; to: string; min?: string }) {
  return (
    <section className="card flex flex-col gap-3">
      <SectionTitle icon={<Download size={18} />} ink="blue">Salary statement</SectionTitle>
      <p className="muted text-sm">{"Attendance for each day (present, absent, clock in / out, late, left early) and the salary worked out for those days, with advances and payments."}</p>
      <form method="get" action="/api/m/salary-statement" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="employeeId" value={employeeId} />
        <div>
          <label className="label">From</label>
          <DateInput name="from" defaultValue={from} min={min} className="w-44" />
        </div>
        <div>
          <label className="label">To</label>
          <DateInput name="to" defaultValue={to} min={min} className="w-44" />
        </div>
        <div className="flex gap-2">
          <button type="submit" name="format" value="pdf" className="btn-primary"><Download size={16} /> PDF</button>
          <button type="submit" name="format" value="xlsx" className="btn-secondary"><Download size={16} /> Excel</button>
        </div>
      </form>
    </section>
  );
}
