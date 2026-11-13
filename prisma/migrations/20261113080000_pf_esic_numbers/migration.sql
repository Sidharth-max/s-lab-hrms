-- AlterTable: PF UAN and ESIC IP numbers for employees with PF / ESIC on.
ALTER TABLE "Employee" ADD COLUMN "uanNumber" TEXT,
ADD COLUMN "esicNumber" TEXT;
