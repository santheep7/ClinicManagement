import { Response } from "express";
import { Request } from "express";
import { prisma } from "./prismaClient";

interface AuthRequest extends Request {
  user?: Record<string, unknown>;
  clinicId?: string;
}

// GET /api/vital-configs
export async function getVitalConfigs(req: Request, res: Response) {
  try {
    const clinicId = (req as AuthRequest).clinicId;
    if (!clinicId) {
      return res.status(400).json({ error: "Clinic context is required." });
    }

    const configs = await prisma.departmentVitalsConfig.findMany({
      where: { clinicId },
    });

    return res.json({ configs });
  } catch (error: any) {
    console.error("Get vital configs error:", error);
    return res.status(500).json({ error: "Unable to fetch vital configurations.", details: error?.message });
  }
}

// POST /api/vital-configs
export async function upsertVitalConfig(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest;
    const clinicId = authReq.clinicId;
    const role = authReq.user?.role;

    if (!clinicId) {
      return res.status(400).json({ error: "Clinic context is required." });
    }

    if (role !== "clinic_admin" && role !== "admin") {
      return res.status(403).json({ error: "Only clinic administrators can configure vitals." });
    }

    const { department, vitals } = req.body;

    if (!department || typeof department !== "string" || department.trim().length === 0) {
      return res.status(400).json({ error: "Department name is required." });
    }

    if (!Array.isArray(vitals)) {
      return res.status(400).json({ error: "Vitals must be an array of vital keys." });
    }

    const trimmedDept = department.trim();

    const config = await prisma.departmentVitalsConfig.upsert({
      where: {
        clinicId_department: {
          clinicId,
          department: trimmedDept,
        },
      },
      update: {
        vitals,
      },
      create: {
        clinicId,
        department: trimmedDept,
        vitals,
      },
    });

    return res.status(200).json({ config });
  } catch (error: any) {
    console.error("Upsert vital config error:", error);
    return res.status(500).json({ error: "Unable to save vital configuration.", details: error?.message });
  }
}

// DELETE /api/vital-configs/:department
export async function deleteVitalConfig(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest;
    const clinicId = authReq.clinicId;
    const role = authReq.user?.role;
    const { department } = req.params;

    if (!clinicId) {
      return res.status(400).json({ error: "Clinic context is required." });
    }

    if (role !== "clinic_admin" && role !== "admin") {
      return res.status(403).json({ error: "Only clinic administrators can configure vitals." });
    }

    if (!department) {
      return res.status(400).json({ error: "Department is required." });
    }

    await prisma.departmentVitalsConfig.deleteMany({
      where: {
        clinicId,
        department: {
          equals: department,
          mode: "insensitive",
        },
      },
    });

    return res.status(204).send();
  } catch (error: any) {
    console.error("Delete vital config error:", error);
    return res.status(500).json({ error: "Unable to delete vital configuration.", details: error?.message });
  }
}
