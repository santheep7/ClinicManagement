import { Request, Response } from "express";
import { prisma } from "./prismaClient";
import crypto from "crypto";

// ─── Add Clinic ───────────────────────────────────────────────────────────────

export async function addClinic(req: Request, res: Response) {
  try {
    const { name, address, phone, logo, brandColor } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Clinic name is required." });
    }
    if (!address || typeof address !== "string" || address.trim().length === 0) {
      return res.status(400).json({ error: "Clinic address is required." });
    }
    if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
      return res.status(400).json({ error: "Clinic phone is required." });
    }

    const adminSecret = req.headers["x-admin-secret"];
    const expectedSecret = process.env.ADMIN_SECRET || "super-secret-admin-key-2026";
    if (adminSecret !== expectedSecret) {
      return res.status(401).json({ error: "Unauthorized: Invalid admin secret" });
    }

    if (brandColor && typeof brandColor === "string") {
      if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(brandColor)) {
        return res.status(400).json({ error: "Invalid brand color. Use a hex color like #0ea5e9." });
      }
    }

    if (logo && typeof logo === "string") {
      const isUrl = logo.startsWith("http://") || logo.startsWith("https://");
      const isDataUri = logo.startsWith("data:image/");
      if (!isUrl && !isDataUri) {
        return res.status(400).json({ error: "Logo must be a valid URL or base64 data URI." });
      }
    }

    let clinicId = "";
    let isUnique = false;
    while (!isUnique) {
      clinicId = `CLINIC-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      const existing = await prisma.clinic.findUnique({ where: { clinicId } });
      if (!existing) isUnique = true;
    }

    const newClinic = await prisma.clinic.create({
      data: {
        clinicId,
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        logo: logo?.trim() || null,
        brandColor: brandColor?.trim() || null,
        isActive: true,
      },
    });

    return res.status(201).json({ clinic: newClinic });
  } catch (error: any) {
    console.error("Add clinic error:", error);
    return res.status(500).json({ error: "Unable to add clinic.", details: error?.message });
  }
}

// ─── Update Clinic Branding ───────────────────────────────────────────────────

export async function updateClinic(req: Request, res: Response) {
  try {
    const adminSecret = req.headers["x-admin-secret"];
    const expectedSecret = process.env.ADMIN_SECRET || "super-secret-admin-key-2026";
    if (adminSecret !== expectedSecret) {
      return res.status(401).json({ error: "Unauthorized: Invalid admin secret" });
    }

    const { id } = req.params;
    const { name, address, phone, logo, brandColor, isActive } = req.body;

    const clinic = await prisma.clinic.findUnique({ where: { id } });
    if (!clinic) {
      return res.status(404).json({ error: "Clinic not found." });
    }

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return res.status(400).json({ error: "Clinic name cannot be empty." });
    }
    if (brandColor !== undefined && brandColor !== null) {
      if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(brandColor)) {
        return res.status(400).json({ error: "Invalid brand color. Use a hex color like #0ea5e9." });
      }
    }
    if (logo !== undefined && logo !== null) {
      const isUrl = logo.startsWith("http://") || logo.startsWith("https://");
      const isDataUri = logo.startsWith("data:image/");
      if (!isUrl && !isDataUri) {
        return res.status(400).json({ error: "Logo must be a valid URL or base64 data URI." });
      }
    }

    const updated = await prisma.clinic.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address.trim() }),
        ...(phone !== undefined && { phone: phone.trim() }),
        ...(logo !== undefined && { logo: logo?.trim() || null }),
        ...(brandColor !== undefined && { brandColor: brandColor || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return res.json({ clinic: updated });
  } catch (error: any) {
    console.error("Update clinic error:", error);
    return res.status(500).json({ error: "Unable to update clinic.", details: error?.message });
  }
}

// ─── Get Active Clinics (public — used by login page) ────────────────────────

export async function getActiveClinics(req: Request, res: Response) {
  try {
    const clinics = await prisma.clinic.findMany({
      where: { isActive: true },
      select: {
        id: true,
        clinicId: true,
        name: true,
        address: true,
        logo: true,
        brandColor: true,
        isActive: true, // ✅ FIXED: was missing — caused frontend isActive to be undefined
      },
    });
    return res.json({ clinics });
  } catch (error: any) {
    console.error("Get clinics error:", error);
    return res.status(500).json({ error: "Unable to fetch clinics." });
  }
}

// ─── Get All Clinics (admin — includes inactive) ──────────────────────────────

export async function getAllClinics(req: Request, res: Response) {
  try {
    const adminSecret = req.headers["x-admin-secret"];
    const expectedSecret = process.env.ADMIN_SECRET || "super-secret-admin-key-2026";
    if (adminSecret !== expectedSecret) {
      return res.status(401).json({ error: "Unauthorized: Invalid admin secret" });
    }

    const clinics = await prisma.clinic.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        clinicId: true,
        name: true,
        address: true,
        phone: true,
        logo: true,
        brandColor: true,
        isActive: true,
      },
    });
    return res.json({ clinics });
  } catch (error: any) {
    console.error("Get all clinics error:", error);
    return res.status(500).json({ error: "Unable to fetch clinics." });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string;
  fullName: string;
  role: string;
  department: string | null;
  employeeId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMedicalStaff(role: string): boolean {
  const r = role.toLowerCase();
  const NON_MEDICAL = [
    "receptionist", "admin", "administrator", "manager",
    "clerk", "front desk", "billing", "hr", "housekeeping", "security",
  ];
  return !NON_MEDICAL.some((term) => r.includes(term));
}

function mapRoleToFaculty(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("doctor") || r.includes("physician") || r.includes("surgeon") || r.includes("consultant")) return "Medical Faculty";
  if (r.includes("nurse") || r.includes("nursing")) return "Nursing Faculty";
  if (r.includes("lab") || r.includes("technician") || r.includes("therapist") || r.includes("pharmacist")) return "Allied Health";
  if (r.includes("receptionist") || r.includes("front desk") || r.includes("clerk")) return "Reception";
  if (r.includes("admin") || r.includes("administrator") || r.includes("manager") || r.includes("billing") || r.includes("hr")) return "Administrative";
  return "General Staff";
}

// ─── GET /api/clinics/:id/staff ───────────────────────────────────────────────

export async function getClinicStaff(req: Request, res: Response) {
  try {
    const adminSecret = req.headers["x-admin-secret"];
    const expectedSecret = process.env.ADMIN_SECRET || "super-secret-admin-key-2026";
    if (adminSecret !== expectedSecret) {
      return res.status(401).json({ error: "Unauthorized: Invalid admin secret" });
    }

    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Clinic ID is required." });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!clinic) return res.status(404).json({ error: "Clinic not found." });
    if (!clinic.isActive) return res.status(403).json({ error: "This clinic is inactive." });

    const users: StaffUser[] = await prisma.user.findMany({
      where: { clinicId: id },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, role: true, department: true, employeeId: true },
    });

    const deptMap: Record<string, { id: string; name: string; doctors: object[] }> = {};

    users.forEach((user: StaffUser) => {
      let deptName = user.department?.trim();
      if (!deptName) deptName = isMedicalStaff(user.role) ? "General" : mapRoleToFaculty(user.role);

      if (!deptMap[deptName]) {
        deptMap[deptName] = { id: deptName.toLowerCase().replace(/\s+/g, "-"), name: deptName, doctors: [] };
      }

      deptMap[deptName].doctors.push({
        id: user.id,
        name: user.fullName,
        role: user.role,
        faculty: mapRoleToFaculty(user.role),
        employeeId: user.employeeId,
        initials: user.fullName.split(" ").filter(Boolean).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2),
      });
    });

    const departments = Object.values(deptMap).sort((a, b) => a.name.localeCompare(b.name));

    const facultyMap: Record<string, number> = {};
    users.forEach((user: StaffUser) => {
      const faculty = mapRoleToFaculty(user.role);
      facultyMap[faculty] = (facultyMap[faculty] || 0) + 1;
    });
    const facultySummary = Object.entries(facultyMap)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({ departments, facultySummary });
  } catch (error: any) {
    console.error("Get clinic staff error:", error);
    return res.status(500).json({ error: "Unable to fetch clinic staff.", details: error?.message });
  }
}