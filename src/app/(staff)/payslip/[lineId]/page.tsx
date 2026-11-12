import { notFound } from "next/navigation";
import { Payslip } from "@/components/Payslip";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeSite } from "@/lib/permissions";

export default async function StaffPayslip({ params }: PageProps<"/payslip/[lineId]">) {
  const actor = await requireStaff();
  const { lineId } = await params;
  const line = await db.payrollLine.findFirst({
    where: { id: lineId, run: { businessId: actor.businessId } },
    include: { run: true, employee: { include: { site: true } } },
  });
  if (!line || !canSeeSite(actor, line.employee.siteId)) notFound();
  const business = await db.business.findUniqueOrThrow({ where: { id: actor.businessId } });
  return <Payslip line={line} business={business} />;
}
