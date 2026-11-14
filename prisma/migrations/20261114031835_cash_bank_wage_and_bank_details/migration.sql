-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "bankIfsc" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "cashWage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "upiId" TEXT;

-- AlterTable
ALTER TABLE "WageChange" ADD COLUMN     "cashWage" INTEGER NOT NULL DEFAULT 0;
