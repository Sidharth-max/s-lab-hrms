-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "dayRules" JSONB,
ALTER COLUMN "weeklyOffDays" SET DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "customWeeklyOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyOffDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
