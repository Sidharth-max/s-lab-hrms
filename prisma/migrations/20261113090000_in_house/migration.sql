-- AlterTable: in-house employees are marked present automatically on working days.
ALTER TABLE "Employee" ADD COLUMN "inHouse" BOOLEAN NOT NULL DEFAULT false;
