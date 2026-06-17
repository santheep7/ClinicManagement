CREATE TABLE "Appointment" (
  "id"           TEXT      NOT NULL DEFAULT gen_random_uuid()::text,
  "clinicId"     TEXT      NOT NULL,
  "patientName"  TEXT      NOT NULL,
  "patientPhone" TEXT      NOT NULL,
  "doctorId"     TEXT      NOT NULL,
  "doctorName"   TEXT      NOT NULL,
  "department"   TEXT      NOT NULL,
  "date"         TEXT      NOT NULL,
  "timeSlot"     TEXT      NOT NULL,
  "reason"       TEXT      NOT NULL DEFAULT '',
  "status"       TEXT      NOT NULL DEFAULT 'booked',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);
