import { Request, Response } from "express";
import { prisma } from "./prismaClient";

type PatientInput = {
  queueId?: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  doctorId: string; 
  department: string;
  reason: string;
  priority: string;
  checkInTime: string;
  status?: string;
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  symptoms?: string;
  chiefComplaint?: string;
  primaryDiagnosis?: string;
  notes?: string;
  followUp?: string;
  tests?: string[];
  medications?: any;
};

function mapPatientToQueueItem(patient: any) {
  // Safe parsing for Prisma's strict Json / JsonValue type matching
  let parsedMedications: any = [];
  if (patient.medications) {
    if (typeof patient.medications === "string") {
      try {
        parsedMedications = JSON.parse(patient.medications);
      } catch {
        parsedMedications = [];
      }
    } else {
      parsedMedications = patient.medications;
    }
  }

  return {
    id: patient.id, 
    queueId: patient.queueId,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    phone: patient.phone,
    address: patient.address,
    doctorId: patient.doctorId, 
    doctorName: patient.doctor?.fullName ?? undefined, // Derived if relational object is loaded
    department: patient.department,
    reason: patient.reason,
    priority: patient.priority,
    checkInTime: patient.checkInTime,
    status: patient.status,
    bloodPressure: patient.bloodPressure,
    heartRate: String(patient.heartRate),
    temperature: String(patient.temperature),
    symptoms: patient.symptoms,
    chiefComplaint: patient.chiefComplaint,
    primaryDiagnosis: patient.primaryDiagnosis,
    notes: patient.notes,
    followUp: patient.followUp,
    // Explicit array type casting to bypass the String[] Prisma compilation block
    tests: (patient.tests as string[]) ?? [],
    medications: parsedMedications,
  };
}

function generateQueueId() {
  return `Q-${Math.floor(1000 + Math.random() * 9000)}`;
}

function normalizePatientInput(body: any): PatientInput {
  return {
    queueId: body.queueId || body.id,
    name: String(body.name ?? "").trim(),
    age: body.age !== undefined && body.age !== null ? Number(body.age) : 0,
    gender: String(body.gender ?? "Unknown"),
    phone: String(body.phone ?? "").trim(),
    address: String(body.address ?? "").trim(),
    // Standardizes doctor selection fallback types if coming from different client routes
    doctorId: String(body.doctorId ?? body.doctor ?? "").trim(), 
    department: String(body.department ?? "").trim(),
    reason: String(body.reason ?? "").trim(),
    priority: String(body.priority ?? "Medium").trim(),
    checkInTime: String(body.checkInTime ?? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })),
    status: String(body.status ?? "pending").trim(),
    bloodPressure: String(body.bloodPressure ?? ""),
    heartRate: body.heartRate !== undefined && body.heartRate !== null ? Number(body.heartRate) : 0,
    temperature: body.temperature !== undefined && body.temperature !== null ? Number(body.temperature) : 0.0,
    symptoms: String(body.symptoms ?? ""),
    chiefComplaint: String(body.chiefComplaint ?? ""),
    primaryDiagnosis: String(body.primaryDiagnosis ?? ""),
    notes: String(body.notes ?? ""),
    followUp: body.followUp ? String(body.followUp) : undefined,
    tests: Array.isArray(body.tests) ? body.tests.map(String) : [],
    medications: body.medications ?? [],
  };
}

export async function createPatient(req: Request, res: Response) {
  try {
    const input = normalizePatientInput(req.body);
    
    if (!input.name || input.age === undefined || input.age === null || !input.phone || !input.address || !input.doctorId || !input.department || !input.reason || !input.priority) {
      return res.status(400).json({ error: "Missing required patient fields. Please verify doctorId is provided." });
    }

    // Prevents database crash by validating that the linked doctor profile actually exists
    const doctorExists = await prisma.user.findUnique({ where: { id: input.doctorId } });
    if (!doctorExists) {
      return res.status(404).json({ error: "The assigned doctor record was not found." });
    }

    const queueId = input.queueId?.trim() || generateQueueId();

    const patient = await prisma.patient.create({
      data: {
        queueId,
        name: input.name,
        age: input.age,
        gender: input.gender,
        phone: input.phone,
        address: input.address,
        doctorId: input.doctorId, 
        department: input.department,
        reason: input.reason,
        priority: input.priority,
        checkInTime: input.checkInTime,
        status: input.status,
        bloodPressure: input.bloodPressure,
        heartRate: input.heartRate,
        temperature: input.temperature,
        symptoms: input.symptoms,
        chiefComplaint: input.chiefComplaint,
        primaryDiagnosis: input.primaryDiagnosis,
        notes: input.notes,
        followUp: input.followUp,
        tests: input.tests,
        medications: input.medications,
      },
      include: {
        doctor: true 
      }
    });

    return res.status(201).json({ patient: mapPatientToQueueItem(patient) });
  } catch (error: any) {
    console.error("Create patient error:", error);
    return res.status(500).json({ error: "Unable to create patient.", details: error?.message });
  }
}

export async function getPatients(_req: Request, res: Response) {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { createdAt: "desc" },
      include: { doctor: true } 
    });
    return res.json({ patients: patients.map(mapPatientToQueueItem) });
  } catch (error: any) {
    console.error("Get patients error:", error);
    return res.status(500).json({ error: "Unable to fetch patients.", details: error?.message });
  }
}

export async function getPatientById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const patient = await prisma.patient.findUnique({
      where: { queueId: id },
      include: { doctor: true }
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    return res.json({ patient: mapPatientToQueueItem(patient) });
  } catch (error: any) {
    console.error("Get patient by id error:", error);
    return res.status(500).json({ error: "Unable to fetch patient.", details: error?.message });
  }
}

export async function updatePatient(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const input = normalizePatientInput(req.body);

    const patient = await prisma.patient.findUnique({
      where: { queueId: id },
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    // Validate foreign key changes if updating to a new doctor
    if (input.doctorId && input.doctorId !== patient.doctorId) {
      const doctorExists = await prisma.user.findUnique({ where: { id: input.doctorId } });
      if (!doctorExists) {
        return res.status(404).json({ error: "The new assigned doctor record was not found." });
      }
    }

    const updated = await prisma.patient.update({
      where: { queueId: id },
      data: {
        name: input.name || patient.name,
        age: input.age ?? patient.age,
        gender: input.gender || patient.gender,
        phone: input.phone || patient.phone,
        address: input.address || patient.address,
        doctorId: input.doctorId || patient.doctorId, 
        department: input.department || patient.department,
        reason: input.reason || patient.reason,
        priority: input.priority || patient.priority,
        checkInTime: input.checkInTime || patient.checkInTime,
        status: input.status || patient.status,
        bloodPressure: input.bloodPressure ?? patient.bloodPressure,
        heartRate: input.heartRate ?? patient.heartRate,
        temperature: input.temperature ?? patient.temperature,
        symptoms: input.symptoms ?? patient.symptoms,
        chiefComplaint: input.chiefComplaint ?? patient.chiefComplaint,
        primaryDiagnosis: input.primaryDiagnosis ?? patient.primaryDiagnosis,
        notes: input.notes ?? patient.notes,
        followUp: input.followUp !== undefined ? input.followUp : patient.followUp,
        tests: input.tests && input.tests.length > 0 ? input.tests : (patient.tests as string[]),
        medications: input.medications && input.medications.length > 0 ? input.medications : patient.medications,
      },
      include: {
        doctor: true
      }
    });

    return res.json({ patient: mapPatientToQueueItem(updated) });
  } catch (error: any) {
    console.error("Update patient error:", error);
    return res.status(500).json({ error: "Unable to update patient.", details: error?.message });
  }
}

export async function deletePatient(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const patient = await prisma.patient.findUnique({
      where: { id: id },
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    await prisma.patient.delete({ where: { id: id } });
    return res.status(204).send();
  } catch (error: any) {
    console.error("Delete patient error:", error);
    return res.status(500).json({ error: "Unable to delete patient.", details: error?.message });
  }
}