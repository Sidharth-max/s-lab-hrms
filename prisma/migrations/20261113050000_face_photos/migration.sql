-- AlterTable: an employee can now have several enrolled face photos.
ALTER TABLE "Employee" ADD COLUMN "faceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Existing single photo becomes the first entry.
UPDATE "Employee" SET "faceIds" = ARRAY["faceId"] WHERE "faceId" IS NOT NULL;
