-- Simple running salary ledger: payments and salary history replace month-wise payroll.

CREATE TABLE "SalaryPayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidOn" DATE NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'CASH',
    "ref" TEXT,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    CONSTRAINT "SalaryPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalaryPayment_employeeId_paidOn_idx" ON "SalaryPayment"("employeeId", "paidOn");
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WageChange" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "wageType" "WageType" NOT NULL,
    "monthlyWage" INTEGER NOT NULL DEFAULT 0,
    "dailyWage" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WageChange_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WageChange_employeeId_effectiveFrom_key" ON "WageChange"("employeeId", "effectiveFrom");
ALTER TABLE "WageChange" ADD CONSTRAINT "WageChange_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extras and deductions now belong to a day instead of a salary month.
ALTER TABLE "Adjustment" ADD COLUMN "onDate" DATE;
UPDATE "Adjustment" SET "onDate" = (("month" || '-01')::date + interval '1 month' - interval '1 day')::date;
ALTER TABLE "Adjustment" ALTER COLUMN "onDate" SET NOT NULL;

-- Everyone's current salary applies from their joining date.
INSERT INTO "WageChange" ("id", "employeeId", "effectiveFrom", "wageType", "monthlyWage", "dailyWage")
SELECT gen_random_uuid()::text, "id", "joinedOn", "wageType", "monthlyWage", "dailyWage" FROM "Employee";

-- Salary already paid in the old month-wise sheets becomes payments in the ledger.
INSERT INTO "SalaryPayment" ("id", "businessId", "employeeId", "amount", "paidOn", "mode", "ref", "note", "createdBy", "createdAt")
SELECT gen_random_uuid()::text, r."businessId", l."employeeId", l."paidAmount",
       COALESCE(l."paidOn", ((r."month" || '-01')::date + interval '1 month' - interval '1 day')::date),
       COALESCE(l."paymentMode", 'CASH'), l."paymentRef", 'Salary for ' || r."month",
       COALESCE(r."lockedBy", 'system'), COALESCE(r."lockedAt", CURRENT_TIMESTAMP)
FROM "PayrollLine" l JOIN "PayrollRun" r ON r."id" = l."runId"
WHERE l."paidAmount" > 0;
