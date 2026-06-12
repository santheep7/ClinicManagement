-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "checkInTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "bloodPressure" TEXT NOT NULL DEFAULT '',
    "heartRate" INTEGER NOT NULL DEFAULT 0,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "symptoms" TEXT NOT NULL DEFAULT '',
    "chiefComplaint" TEXT NOT NULL DEFAULT '',
    "primaryDiagnosis" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "followUp" TEXT,
    "tests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "medications" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "doctorId" TEXT NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_queueId_key" ON "Patient"("queueId");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
