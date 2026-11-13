-- AlterTable: salary calculated monthly but paid later in one go.
ALTER TABLE "Employee" ADD COLUMN "holdSalary" BOOLEAN NOT NULL DEFAULT false;
