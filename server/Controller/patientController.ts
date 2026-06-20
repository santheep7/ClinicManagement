import { Request, Response } from "express";
import { prisma } from "./prismaClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthRequest extends Request {
  user?: Record<string, unknown>;
  clinicId?: string;
}

type PatientInput = {
  queueId?: string;
  patientId?: string;
  clinicId?: string;
  isVip?: boolean;
  requestedToken?: number;
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
  spO2?: number;
  respiratoryRate?: number;
  weight?: number;
  height?: number;
  iop?: string;
  peakFlow?: number;
  bloodGlucose?: number;
  painScore?: number;
  symptoms?: string;
  chiefComplaint?: string;
  primaryDiagnosis?: string;
  notes?: string;
  followUp?: string;
  visitType?: string;
  tests?: string[];
  medications?: any;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapPatientToQueueItem(patient: any) {
  let parsedMedications: any = [];
  if (patient.medications) {
    if (typeof patient.medications === "string") {
      try { parsedMedications = JSON.parse(patient.medications); } catch { parsedMedications = []; }
    } else {
      parsedMedications = patient.medications;
    }
  }

  return {
    id: patient.id,
    queueId: patient.queueId,
    patientId: patient.patientId,
    clinicId: patient.clinicId,
    token: patient.token,
    tokenSession: patient.tokenSession,
    isVip: patient.isVip,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    phone: patient.phone,
    address: patient.address,
    doctorId: patient.doctorId,
    doctor: patient.doctor?.fullName ?? "",
    department: patient.department,
    reason: patient.reason,
    priority: patient.priority,
    checkInTime: patient.checkInTime,
    status: patient.status,
    bloodPressure: patient.bloodPressure,
    heartRate: String(patient.heartRate),
    temperature: String(patient.temperature),
    spO2: patient.spO2 !== null && patient.spO2 !== undefined ? Number(patient.spO2) : null,
    respiratoryRate: patient.respiratoryRate !== null && patient.respiratoryRate !== undefined ? Number(patient.respiratoryRate) : null,
    weight: patient.weight !== null && patient.weight !== undefined ? Number(patient.weight) : null,
    height: patient.height !== null && patient.height !== undefined ? Number(patient.height) : null,
    iop: patient.iop !== null && patient.iop !== undefined ? String(patient.iop) : null,
    peakFlow: patient.peakFlow !== null && patient.peakFlow !== undefined ? Number(patient.peakFlow) : null,
    bloodGlucose: patient.bloodGlucose !== null && patient.bloodGlucose !== undefined ? Number(patient.bloodGlucose) : null,
    painScore: patient.painScore !== null && patient.painScore !== undefined ? Number(patient.painScore) : null,
    symptoms: patient.symptoms,
    chiefComplaint: patient.chiefComplaint,
    primaryDiagnosis: patient.primaryDiagnosis,
    notes: patient.notes,
    followUp: patient.followUp,
    visitType: patient.visitType,
    tests: (patient.tests as string[]) ?? [],
    medications: parsedMedications,
  };
}

function generateQueueId() {
  return `Q-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Token system:
 * - T001–T005  → VIP reserved (blocked for regular patients)
 * - T006–T015  → Morning session  (10 slots)
 * - T016–T025  → Afternoon session (10 slots)
 * - T026+      → Overflow
 *
 * Regular patients auto-assign from T006.
 * VIP patients get one of T001–T005 (passed explicitly).
 */
const VIP_RESERVED_START = 1;
const VIP_RESERVED_END   = 5;
const MORNING_START      = 6;
const MORNING_END        = 15;
const AFTERNOON_START    = 16;
const AFTERNOON_END      = 25;

function tokenSession(tokenNum: number): string {
  if (tokenNum <= VIP_RESERVED_END) return "vip";
  if (tokenNum <= MORNING_END)       return "morning";
  if (tokenNum <= AFTERNOON_END)     return "afternoon";
  return "overflow";
}

function fmtToken(n: number): string {
  return `T${String(n).padStart(3, "0")}`;
}

async function generateToken(doctorId: string, clinicId: string, isVip: boolean, requestedToken?: number): Promise<{ token: string; session: string }> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Fetch all tokens already assigned today for this doctor
  const todayPatients = await prisma.patient.findMany({
    where: { doctorId, clinicId, createdAt: { gte: startOfDay, lte: endOfDay } },
    select: { token: true },
  });
  const usedTokenNums = new Set(
    todayPatients.map(p => parseInt(p.token.replace("T", ""), 10)).filter(n => !isNaN(n))
  );

  if (isVip) {
    // VIP: assign requested token or first free slot in T001–T005
    if (requestedToken && requestedToken >= VIP_RESERVED_START && requestedToken <= VIP_RESERVED_END) {
      if (usedTokenNums.has(requestedToken)) throw new Error(`VIP token ${fmtToken(requestedToken)} is already taken.`);
      return { token: fmtToken(requestedToken), session: "vip" };
    }
    for (let n = VIP_RESERVED_START; n <= VIP_RESERVED_END; n++) {
      if (!usedTokenNums.has(n)) return { token: fmtToken(n), session: "vip" };
    }
    throw new Error("All VIP tokens (T001–T005) are already assigned for today.");
  }

  // Regular: start from T006, skip VIP range
  for (let n = MORNING_START; n <= 999; n++) {
    if (!usedTokenNums.has(n)) {
      return { token: fmtToken(n), session: tokenSession(n) };
    }
  }
  throw new Error("No tokens available for today.");
}

/**
 * Generate patient ID: <2-letter clinic prefix><2-digit sequence><2-digit day><2-digit year>
 * e.g. clinic "PLYOK", 1st patient on 14 Jun 2026 → PL011426
 *   PL  = first 2 letters of clinic name
 *   01  = sequence number for that day (01, 02, 03 ...)
 *   14  = day of month
 *   26  = last 2 digits of year
 */
async function generatePatientId(clinicName: string): Promise<string> {
  const prefix = clinicName.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2).padEnd(2, "X");
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  // dateSuffix is the last 4 chars: DDYY
  const dateSuffix = `${dd}${yy}`;

  // Count patients already registered today for this clinic prefix to get sequence
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const todayCount = await prisma.patient.count({
    where: {
      patientId: { startsWith: prefix },
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  const seq = String(todayCount + 1).padStart(2, "0");
  return `${prefix}${seq}${dateSuffix}`;
}

function normalizePatientInput(body: any): PatientInput {
  return {
    queueId: body.queueId || body.id,
    isVip: body.isVip === true || body.isVip === "true",
    requestedToken: body.requestedToken ? Number(body.requestedToken) : undefined,
    name: String(body.name ?? "").trim(),
    age: body.age !== undefined && body.age !== null ? Number(body.age) : 0,
    gender: String(body.gender ?? "Unknown"),
    phone: String(body.phone ?? "").trim(),
    address: String(body.address ?? "").trim(),
    doctorId: String(body.doctorId ?? body.doctor ?? "").trim(),
    department: String(body.department ?? "").trim(),
    reason: String(body.reason ?? "").trim(),
    priority: String(body.priority ?? "Medium").trim(),
    checkInTime: String(body.checkInTime ?? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })),
    status: String(body.status ?? "pending").trim(),
    bloodPressure: String(body.bloodPressure ?? ""),
    heartRate: body.heartRate !== undefined && body.heartRate !== null ? Number(body.heartRate) : 0,
    temperature: body.temperature !== undefined && body.temperature !== null ? Number(body.temperature) : 0.0,
    spO2: body.spO2 !== undefined && body.spO2 !== null && body.spO2 !== "" ? Number(body.spO2) : undefined,
    respiratoryRate: body.respiratoryRate !== undefined && body.respiratoryRate !== null && body.respiratoryRate !== "" ? Number(body.respiratoryRate) : undefined,
    weight: body.weight !== undefined && body.weight !== null && body.weight !== "" ? Number(body.weight) : undefined,
    height: body.height !== undefined && body.height !== null && body.height !== "" ? Number(body.height) : undefined,
    iop: body.iop !== undefined && body.iop !== null && body.iop !== "" ? String(body.iop).trim() : undefined,
    peakFlow: body.peakFlow !== undefined && body.peakFlow !== null && body.peakFlow !== "" ? Number(body.peakFlow) : undefined,
    bloodGlucose: body.bloodGlucose !== undefined && body.bloodGlucose !== null && body.bloodGlucose !== "" ? Number(body.bloodGlucose) : undefined,
    painScore: body.painScore !== undefined && body.painScore !== null && body.painScore !== "" ? Number(body.painScore) : undefined,
    symptoms: String(body.symptoms ?? ""),
    chiefComplaint: String(body.chiefComplaint ?? ""),
    primaryDiagnosis: String(body.primaryDiagnosis ?? ""),
    notes: String(body.notes ?? ""),
    followUp: body.followUp ? String(body.followUp) : undefined,
    visitType: String(body.visitType ?? "new"),
    tests: Array.isArray(body.tests) ? body.tests.map(String) : [],
    medications: body.medications ?? [],
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function createPatient(req: Request, res: Response) {
  try {
    const input = normalizePatientInput(req.body);
    const clinicId = (req as AuthRequest).clinicId || String(req.body.clinicId ?? "");

    if (!input.name || input.age === undefined || !input.phone || !input.address || !input.department || !input.reason || !input.priority) {
      return res.status(400).json({ error: "Missing required patient fields." });
    }
    if (!clinicId) {
      return res.status(400).json({ error: "Clinic context is required." });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } });
    if (!clinic) {
      return res.status(400).json({ error: "Clinic not found." });
    }

    // Doctor optional for walk-ins
    if (input.doctorId) {
      const doctorExists = await prisma.user.findUnique({ where: { id: input.doctorId } });
      if (!doctorExists) {
        return res.status(404).json({ error: "The assigned doctor record was not found." });
      }
    }

    const queueId = input.queueId?.trim() || generateQueueId();
    const patientId = await generatePatientId(clinic.name);

    // Generate token — VIP gets T001–T005, regular starts from T006
    const { token, session } = await generateToken(
      input.doctorId || "",
      clinicId,
      input.isVip ?? false,
      input.requestedToken
    );

    const patient = await prisma.patient.create({
      data: {
        queueId,
        patientId,
        clinicId,
        token,
        tokenSession: session,
        isVip: input.isVip ?? false,
        name: input.name,
        age: input.age,
        gender: input.gender,
        phone: input.phone,
        address: input.address,
        doctorId: input.doctorId || "",
        department: input.department,
        reason: input.reason,
        priority: input.priority,
        checkInTime: input.checkInTime,
        status: input.status,
        bloodPressure: input.bloodPressure,
        heartRate: input.heartRate,
        temperature: input.temperature,
        spO2: input.spO2 ?? null,
        respiratoryRate: input.respiratoryRate ?? null,
        weight: input.weight ?? null,
        height: input.height ?? null,
        iop: input.iop ?? null,
        peakFlow: input.peakFlow ?? null,
        bloodGlucose: input.bloodGlucose ?? null,
        painScore: input.painScore ?? null,
        symptoms: input.symptoms,
        chiefComplaint: input.chiefComplaint,
        primaryDiagnosis: input.primaryDiagnosis,
        notes: input.notes,
        followUp: input.followUp,
        visitType: input.visitType ?? "new",
        tests: input.tests,
        medications: input.medications,
      },
      include: { doctor: true },
    });

    return res.status(201).json({ patient: mapPatientToQueueItem(patient) });
  } catch (error: any) {
    console.error("Create patient error:", error);
    return res.status(500).json({ error: "Unable to create patient.", details: error?.message });
  }
}

export async function getPatients(req: Request, res: Response) {
  try {
    const clinicId = (req as AuthRequest).clinicId;
    const { doctorId } = req.query;

    const patients = await prisma.patient.findMany({
      where: {
        ...(clinicId ? { clinicId } : {}),
        ...(doctorId ? { doctorId: String(doctorId) } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { doctor: true },
    });

    const patientsWithCount = await Promise.all(
      patients.map(async (p) => {
        const count = await prisma.patient.count({
          where: {
            phone: p.phone,
            status: "completed",
            ...(clinicId ? { clinicId } : {}),
          },
        });
        return {
          ...mapPatientToQueueItem(p),
          visitCount: count || 1,
        };
      })
    );

    return res.json({ patients: patientsWithCount });
  } catch (error: any) {
    console.error("Get patients error:", error);
    return res.status(500).json({ error: "Unable to fetch patients.", details: error?.message });
  }
}

// ── GET /api/patients/history/:phone — last 5 completed visits for a patient ──
export async function getPatientHistory(req: Request, res: Response) {
  try {
    const { phone } = req.params;
    const clinicId  = (req as AuthRequest).clinicId;
    const { excludeId } = req.query; // current visit queueId to exclude

    if (!phone) return res.status(400).json({ error: "Phone number is required." });

    const records = await prisma.patient.findMany({
      where: {
        phone: decodeURIComponent(phone),
        status: "completed",
        ...(clinicId  ? { clinicId }                       : {}),
        ...(excludeId ? { queueId: { not: String(excludeId) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        queueId:         true,
        patientId:       true,
        createdAt:       true,
        reason:          true,
        primaryDiagnosis: true,
        chiefComplaint:  true,
        symptoms:        true,
        notes:           true,
        followUp:        true,
        tests:           true,
        medications:     true,
        bloodPressure:   true,
        heartRate:       true,
        temperature:     true,
        visitType:       true,
        doctor: { select: { fullName: true } },
      },
    });

    const history = records.map(r => {
      let meds: any[] = [];
      if (r.medications) {
        try { meds = typeof r.medications === "string" ? JSON.parse(r.medications) : (r.medications as any[]); } catch {}
      }
      return {
        queueId:         r.queueId,
        patientId:       r.patientId,
        date:            r.createdAt.toISOString(),
        reason:          r.reason,
        diagnosis:       r.primaryDiagnosis,
        chiefComplaint:  r.chiefComplaint,
        symptoms:        r.symptoms,
        notes:           r.notes,
        followUp:        r.followUp,
        tests:           r.tests as string[],
        medications:     meds.map((m: any) => `${m.name ?? ""} ${m.dosage ?? ""}`.trim()).filter(Boolean),
        bloodPressure:   r.bloodPressure,
        heartRate:       r.heartRate,
        temperature:     r.temperature,
        visitType:       r.visitType ?? "new",
        doctor:          r.doctor?.fullName ?? "",
      };
    });

    return res.json({ history });
  } catch (error: any) {
    console.error("Get patient history error:", error);
    return res.status(500).json({ error: "Unable to fetch patient history.", details: error?.message });
  }
}

export async function getPatientById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const clinicId = (req as AuthRequest).clinicId;

    const patient = await prisma.patient.findFirst({
      where: {
        ...(clinicId ? { clinicId } : {}),
        OR: [
          { queueId: id },
          { id },
        ],
      },
      include: { doctor: true },
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    const count = await prisma.patient.count({
      where: {
        phone: patient.phone,
        status: "completed",
        ...(clinicId ? { clinicId } : {}),
      },
    });

    return res.json({
      patient: {
        ...mapPatientToQueueItem(patient),
        visitCount: count || 1,
      },
    });
  } catch (error: any) {
    console.error("Get patient by id error:", error);
    return res.status(500).json({ error: "Unable to fetch patient.", details: error?.message });
  }
}
export async function searchPatients(req: Request, res: Response) {
  try {
    const clinicId = (req as AuthRequest).clinicId;
    const { name, phone, address } = req.query;

    // If all parameters are completely missing from the request, exit early
    if (!name && !phone && !address) {
      return res.json({ patients: [] });
    }

    // Dynamic array to store active filters and prevent "Blank Field Poisoning"
    const conditions: any[] = [];

    if (name && String(name).trim() !== "") {
      conditions.push({
        name: { contains: String(name).trim(), mode: "insensitive" },
      });
    }

    if (phone && String(phone).trim() !== "") {
      conditions.push({
        phone: { contains: String(phone).trim(), mode: "insensitive" },
      });
    }

    if (address && String(address).trim() !== "") {
      conditions.push({
        address: { contains: String(address).trim(), mode: "insensitive" },
      });
    }

    // If inputs were just empty white spaces, return empty array
    if (conditions.length === 0) {
      return res.json({ patients: [] });
    }

    // Query Prisma using the clean conditions array
    const patients = await prisma.patient.findMany({
      where: {
        ...(clinicId ? { clinicId } : {}),
        AND: conditions, // Combines filters safely without blank strings breaking the query
      },
      orderBy: { createdAt: "desc" },
      include: { doctor: true },
    });

    // Format the results using your existing map helper before sending to frontend
    return res.json({ patients: patients.map(mapPatientToQueueItem) });
  } catch (error: any) {
    console.error("Search patients error:", error);
    return res.status(500).json({ error: "Unable to search patients.", details: error?.message });
  }
}

export async function updatePatient(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const clinicId = (req as AuthRequest).clinicId;
    // Temporary debug: log incoming update payload to help diagnose missing fields
    try { console.log(`[updatePatient] incoming for ${id}:`, req.body); } catch (e) { /* ignore */ }
    const input = normalizePatientInput(req.body);

    const patient = await prisma.patient.findFirst({
      where: { queueId: id, ...(clinicId ? { clinicId } : {}) },
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    if (input.doctorId && input.doctorId !== patient.doctorId) {
      const doctorExists = await prisma.user.findUnique({ where: { id: input.doctorId } });
      if (!doctorExists) {
        return res.status(404).json({ error: "The new assigned doctor record was not found." });
      }
    }

    const updated = await prisma.patient.update({
      where: { queueId: id },
      data: {
        name: 'name' in req.body ? input.name : patient.name,
        age: 'age' in req.body ? input.age : patient.age,
        gender: 'gender' in req.body ? input.gender : patient.gender,
        phone: 'phone' in req.body ? input.phone : patient.phone,
        address: 'address' in req.body ? input.address : patient.address,
        doctorId: input.doctorId || patient.doctorId,
        department: 'department' in req.body ? input.department : patient.department,
        reason: 'reason' in req.body ? input.reason : patient.reason,
        priority: 'priority' in req.body ? input.priority : patient.priority,
        checkInTime: 'checkInTime' in req.body ? input.checkInTime : patient.checkInTime,
        status: 'status' in req.body ? input.status : patient.status,
        bloodPressure: 'bloodPressure' in req.body ? (req.body.bloodPressure ?? patient.bloodPressure) : patient.bloodPressure,
        heartRate: 'heartRate' in req.body ? input.heartRate : patient.heartRate,
        temperature: 'temperature' in req.body ? input.temperature : patient.temperature,
        spO2: 'spO2' in req.body ? (req.body.spO2 === "" || req.body.spO2 === null || req.body.spO2 === undefined ? null : Number(req.body.spO2)) : patient.spO2,
        respiratoryRate: 'respiratoryRate' in req.body ? (req.body.respiratoryRate === "" || req.body.respiratoryRate === null || req.body.respiratoryRate === undefined ? null : Number(req.body.respiratoryRate)) : patient.respiratoryRate,
        weight: 'weight' in req.body ? (req.body.weight === "" || req.body.weight === null || req.body.weight === undefined ? null : Number(req.body.weight)) : patient.weight,
        height: 'height' in req.body ? (req.body.height === "" || req.body.height === null || req.body.height === undefined ? null : Number(req.body.height)) : patient.height,
        iop: 'iop' in req.body ? (req.body.iop === "" || req.body.iop === null || req.body.iop === undefined ? null : String(req.body.iop)) : patient.iop,
        peakFlow: 'peakFlow' in req.body ? (req.body.peakFlow === "" || req.body.peakFlow === null || req.body.peakFlow === undefined ? null : Number(req.body.peakFlow)) : patient.peakFlow,
        bloodGlucose: 'bloodGlucose' in req.body ? (req.body.bloodGlucose === "" || req.body.bloodGlucose === null || req.body.bloodGlucose === undefined ? null : Number(req.body.bloodGlucose)) : patient.bloodGlucose,
        painScore: 'painScore' in req.body ? (req.body.painScore === "" || req.body.painScore === null || req.body.painScore === undefined ? null : Number(req.body.painScore)) : patient.painScore,
        symptoms: 'symptoms' in req.body ? input.symptoms : patient.symptoms,
        chiefComplaint: 'chiefComplaint' in req.body ? input.chiefComplaint : patient.chiefComplaint,
        primaryDiagnosis: 'primaryDiagnosis' in req.body ? input.primaryDiagnosis : patient.primaryDiagnosis,
        notes: 'notes' in req.body ? input.notes : patient.notes,
        followUp: 'followUp' in req.body ? input.followUp : patient.followUp,
        visitType: 'visitType' in req.body ? input.visitType : patient.visitType,
        tests: input.tests && input.tests.length > 0 ? input.tests : (patient.tests as string[]),
        medications: input.medications && input.medications.length > 0 ? input.medications : patient.medications,
      },
      include: { doctor: true },
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
    const clinicId = (req as AuthRequest).clinicId;

    const patient = await prisma.patient.findFirst({
      where: { id, ...(clinicId ? { clinicId } : {}) },
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    await prisma.patient.delete({ where: { id } });
    return res.status(204).send();
  } catch (error: any) {
    console.error("Delete patient error:", error);
    return res.status(500).json({ error: "Unable to delete patient.", details: error?.message });
  }
}
