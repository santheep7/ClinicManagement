-- Add patientId and clinicId to Patient table
ALTER TABLE "Patient" ADD COLUMN "patientId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Patient" ADD COLUMN "clinicId"  TEXT NOT NULL DEFAULT '';

-- Backfill patientId with queueId for existing rows so NOT NULL is satisfied
UPDATE "Patient" SET "patientId" = "queueId" WHERE "patientId" = '';

-- Add unique constraint on patientId
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_patientId_key" UNIQUE ("patientId");

-- Add clinicId to Payment table
ALTER TABLE "Payment" ADD COLUMN "clinicId" TEXT NOT NULL DEFAULT '';
