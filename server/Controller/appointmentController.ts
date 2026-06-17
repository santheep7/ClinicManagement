import { Request, Response } from "express";
import { prisma } from "./prismaClient";

interface AuthRequest extends Request {
  user?: Record<string, unknown>;
  clinicId?: string;
}

// ─── Get appointments for a clinic ────────────────────────────────────────────
export async function getAppointments(req: Request, res: Response) {
  try {
    const clinicId = (req as AuthRequest).clinicId;
    const { date } = req.query;

    const appointments = await prisma.appointment.findMany({
      where: {
        ...(clinicId ? { clinicId } : {}),
        ...(date ? { date: String(date) } : {}),
      },
      orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    });

    return res.json({ appointments });
  } catch (error: any) {
    return res.status(500).json({ error: "Unable to fetch appointments.", details: error?.message });
  }
}

// ─── Create appointment ────────────────────────────────────────────────────────
export async function createAppointment(req: Request, res: Response) {
  try {
    const clinicId = (req as AuthRequest).clinicId || String(req.body.clinicId ?? "");
    const { patientName, patientPhone, doctorId, doctorName, department, date, timeSlot, reason } = req.body;

    if (!patientName || !patientPhone || !doctorId || !date || !timeSlot) {
      return res.status(400).json({ error: "Missing required appointment fields." });
    }
    if (!clinicId) {
      return res.status(400).json({ error: "Clinic context required." });
    }

    // Check slot is not already taken
    const existing = await prisma.appointment.findFirst({
      where: { clinicId, doctorId, date, timeSlot, status: { not: "cancelled" } },
    });
    if (existing) {
      return res.status(409).json({ error: `Slot ${timeSlot} on ${date} is already booked for this doctor.` });
    }

    const appointment = await prisma.appointment.create({
      data: {
        clinicId,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        doctorId,
        doctorName: doctorName?.trim() || "",
        department: department?.trim() || "",
        date,
        timeSlot,
        reason: reason?.trim() || "",
        status: "booked",
      },
    });

    return res.status(201).json({ appointment });
  } catch (error: any) {
    console.error("Create appointment error:", error);
    return res.status(500).json({ error: "Unable to create appointment.", details: error?.message });
  }
}

// ─── Update appointment status ─────────────────────────────────────────────────
export async function updateAppointmentStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const clinicId = (req as AuthRequest).clinicId;

    const appt = await prisma.appointment.findFirst({
      where: { id, ...(clinicId ? { clinicId } : {}) },
    });
    if (!appt) return res.status(404).json({ error: "Appointment not found." });

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    });

    return res.json({ appointment: updated });
  } catch (error: any) {
    return res.status(500).json({ error: "Unable to update appointment.", details: error?.message });
  }
}

// ─── Get booked slots for a doctor on a date ──────────────────────────────────
export async function getBookedSlots(req: Request, res: Response) {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ error: "doctorId and date required." });
    }
    const appointments = await prisma.appointment.findMany({
      where: { doctorId: String(doctorId), date: String(date), status: { not: "cancelled" } },
      select: { timeSlot: true },
    });
    return res.json({ bookedSlots: appointments.map(a => a.timeSlot) });
  } catch (error: any) {
    return res.status(500).json({ error: "Unable to fetch slots.", details: error?.message });
  }
}
