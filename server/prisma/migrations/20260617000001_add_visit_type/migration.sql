-- Add visitType field to Patient table
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "visitType" TEXT NOT NULL DEFAULT 'new';
