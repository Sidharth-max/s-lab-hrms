-- AlterTable: identify the physical phone/tablet so re-registering it does not create a duplicate.
ALTER TABLE "Device" ADD COLUMN "hardwareId" TEXT,
ADD COLUMN "model" TEXT;

-- CreateIndex
CREATE INDEX "Device_businessId_hardwareId_idx" ON "Device"("businessId", "hardwareId");
