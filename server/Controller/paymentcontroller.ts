import { Request, Response } from "express";
import { prisma } from "./prismaClient";

interface AuthRequest extends Request {
  user?: Record<string, unknown>;
  clinicId?: string;
}

// ─── Get All Payments ─────────────────────────────────────────────────────────

export async function getPayments(req: Request, res: Response) {
  try {
    const clinicId = (req as AuthRequest).clinicId;
    const raw = await prisma.payment.findMany({
      where: clinicId ? { clinicId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        doctor: { select: { id: true, fullName: true, department: true } },
      },
    });

    const payments = raw.map((p) => ({ ...p, doctor: p.doctor?.fullName || "" }));
    return res.json({ payments });
  } catch (error: any) {
    console.error("Get payments error:", error);
    return res.status(500).json({ error: "Unable to fetch payments.", details: error?.message });
  }
}

// ─── Add Payment ──────────────────────────────────────────────────────────────

export async function addPayment(req: Request, res: Response) {
  try {
    const clinicId = (req as AuthRequest).clinicId || "";
    const {
      patientName, patientId, date, service, doctorId,
      department, totalAmount, amountPaid,
      paymentMode, referenceNo, notes,
    } = req.body;

    if (!patientName || typeof patientName !== "string" || patientName.trim().length === 0)
      return res.status(400).json({ error: "Patient name is required." });
    if (!service || typeof service !== "string" || service.trim().length === 0)
      return res.status(400).json({ error: "Service is required." });
    if (totalAmount === undefined || isNaN(Number(totalAmount)))
      return res.status(400).json({ error: "Valid total amount is required." });
    if (amountPaid === undefined || isNaN(Number(amountPaid)))
      return res.status(400).json({ error: "Valid amount paid is required." });

    // If doctorId provided, verify it exists
    if (doctorId) {
      const doctor = await prisma.user.findUnique({ where: { id: doctorId } });
      if (!doctor) return res.status(404).json({ error: "Doctor not found." });
    }

    const total = Number(totalAmount);
    const paid  = Number(amountPaid);
    const due   = Math.max(0, total - paid);

    const status =
      paid <= 0     ? "Pending" :
      paid >= total ? "Paid"    : "Partial";

    const payment = await prisma.payment.create({
      data: {
        patientName: patientName.trim(),
        patientId:   patientId?.trim()   || "",
        clinicId,
        date:        date || new Date().toISOString().split("T")[0],
        service:     service.trim(),
        department:  department?.trim()  || "",
        totalAmount: total,
        amountPaid:  paid,
        amountDue:   due,
        paymentMode: paymentMode?.trim() || "",
        status,
        referenceNo: referenceNo?.trim() || "",
        notes:       notes?.trim()       || "",
        ...(doctorId ? { doctorId } : {}),
      },
      include: {
        doctor: { select: { id: true, fullName: true, department: true } },
      },
    });

    // Flatten doctor object → string to match frontend PaymentRecord interface
    return res.status(201).json({
      payment: {
        ...payment,
        doctor: payment.doctor?.fullName || "",
      },
    });
  } catch (error: any) {
    console.error("Add payment error:", error);
    return res.status(500).json({ error: "Unable to add payment.", details: error?.message });
  }
}

// ─── Delete Payment ───────────────────────────────────────────────────────────

export async function deletePayment(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Payment record not found." });

    await prisma.payment.delete({ where: { id } });
    return res.json({ message: "Payment deleted successfully." });
  } catch (error: any) {
    console.error("Delete payment error:", error);
    return res.status(500).json({ error: "Unable to delete payment.", details: error?.message });
  }
}