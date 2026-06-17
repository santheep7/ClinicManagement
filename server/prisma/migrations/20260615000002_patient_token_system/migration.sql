-- Add token fields to Patient table
ALTER TABLE "Patient" ADD COLUMN "token"        TEXT    NOT NULL DEFAULT '';
ALTER TABLE "Patient" ADD COLUMN "tokenSession" TEXT    NOT NULL DEFAULT 'morning';
ALTER TABLE "Patient" ADD COLUMN "isVip"        BOOLEAN NOT NULL DEFAULT false;
