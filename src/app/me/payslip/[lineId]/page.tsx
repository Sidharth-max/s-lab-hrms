import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Payslip } from "@/components/Payslip";
import { getActor } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function MyPayslip({ params }: PageProps<"/me/payslip/[lineId]">) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { lineId } = await params;
  const line = await db.payrollLine.findFirst({
    where: { id: lineId, run: { status: "LOCKED" }, employee: { userId: actor.id } },
    include: { run: true, employee: { include: { site: true, business: true } } },
  });
  if (!line) notFound();
  return (
    <main className="p-4">
      <Link href="/me" className="no-print muted underline">← Back</Link>
      <Payslip line={line} business={line.employee.business} />
    </main>
  );
}
