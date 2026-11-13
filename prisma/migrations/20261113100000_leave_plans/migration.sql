-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable: leave scheduled ahead for an employee.
CREATE TABLE "LeavePlan" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'ACTIVE',
    "plannedTo" DATE,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeavePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeavePlan_employeeId_fromDate_idx" ON "LeavePlan"("employeeId", "fromDate");

-- CreateIndex
CREATE INDEX "LeavePlan_businessId_toDate_idx" ON "LeavePlan"("businessId", "toDate");

-- AddForeignKey
ALTER TABLE "LeavePlan" ADD CONSTRAINT "LeavePlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
