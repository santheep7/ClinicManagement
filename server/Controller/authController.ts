import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { prisma } from "./prismaClient";

const JWT_SECRET = process.env.JWT_SECRET || "replace-with-strong-secret";

interface AuthRequest extends Request {
  user?: Record<string, unknown>;
  clinicId?: string;
}

function createToken(payload: Record<string, unknown>) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
}

export async function register(req: Request, res: Response) {
  try {
    console.log("Register endpoint called with body:", req.body);
    const { fullName, phone, email, password, employeeId, role, department, clinicId } = req.body;

    if (!clinicId || typeof clinicId !== "string" || clinicId.trim().length === 0) {
      return res.status(400).json({ error: "Clinic ID is required for registration." });
    }

    const activeClinic = await prisma.clinic.findUnique({
      where: { clinicId: clinicId.trim(), isActive: true },
    });

    if (!activeClinic) {
      return res.status(400).json({ error: "Invalid or inactive Clinic ID." });
    }

    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
      return res.status(400).json({ error: "Full name is required." });
    }

    if (!phone || typeof phone !== "string" || !/^\+?[\d\s()\-]{7,20}$/.test(phone) || phone.replace(/\D/g, "").length < 7) {
      return res.status(400).json({ error: "A valid phone number is required." });
    }

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "A valid email address is required." });
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must have at least 8 characters." });
    }

    if (!employeeId || typeof employeeId !== "string" || employeeId.trim().length === 0) {
      return res.status(400).json({ error: "Employee ID is required." });
    }

    if (!role || (role !== "doctor" && role !== "receptionist")) {
      return res.status(400).json({ error: "Role must be either doctor or receptionist." });
    }

    if (role === "doctor" && (!department || typeof department !== "string" || department.trim().length === 0)) {
      return res.status(400).json({ error: "Department is required for doctors." });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { employeeId: employeeId.trim() },
        ],
      },
    });

    if (existingUser) {
      return res.status(409).json({ error: "Email or employee ID already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.toLowerCase().trim(),
        employeeId: employeeId.trim(),
        role,
        department: role === "doctor" ? department.trim() : null,
        clinicId: activeClinic.id,
        passwordHash,
      },
    });

    return res.status(201).json({
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        employeeId: user.employeeId,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error: any) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Unable to register user.", details: error?.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || typeof employeeId !== "string" || employeeId.trim().length === 0) {
      return res.status(400).json({ error: "Employee ID is required." });
    }

    if (!password || typeof password !== "string" || password.length === 0) {
      return res.status(400).json({ error: "Password is required." });
    }

    const user = await prisma.user.findUnique({
      where: { employeeId: employeeId.trim() },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid employee ID or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid employee ID or password." });
    }

    const token = createToken({
      sub: user.id,
      employeeId: user.employeeId,
      role: user.role,
      clinicId: user.clinicId ?? "",
    });

    return res.json({
      accessToken: token,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        employeeId: user.employeeId,
        role: user.role,
        department: user.department,
        clinicId: user.clinicId ?? "",
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to login." });
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    (req as AuthRequest).user = decoded;
    (req as AuthRequest).clinicId = decoded.clinicId as string | undefined;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function getDoctors(req: Request, res: Response) {
  try {
    const clinicId = (req as AuthRequest).clinicId;
    const doctors = await prisma.user.findMany({
      where: {
        role: "doctor",
        ...(clinicId ? { clinicId } : {}),
      },
      select: { id: true, fullName: true, department: true },
    });

    return res.json({ doctors: doctors.map((doc) => ({ id: doc.id, name: doc.fullName, department: doc.department })) });
  } catch (error: any) {
    console.error("Unable to fetch doctors:", error);
    return res.status(500).json({ error: "Unable to fetch doctors.", details: error?.message });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  return res.json({ user: req.user });
}

// ── Lookup clinic branding by employee ID (public — no auth needed) ──────────
export async function getClinicByEmployeeId(req: Request, res: Response) {
  try {
    const { employeeId } = req.params;
    if (!employeeId || employeeId.trim().length === 0) {
      return res.status(400).json({ error: "Employee ID required." });
    }
    const user = await prisma.user.findUnique({
      where: { employeeId: employeeId.trim().toUpperCase() },
      select: {
        clinic: {
          select: { id: true, clinicId: true, name: true, address: true, logo: true, brandColor: true, isActive: true },
        },
      },
    });
    if (!user || !user.clinic) {
      return res.status(404).json({ clinic: null });
    }
    return res.json({ clinic: user.clinic });
  } catch (error: any) {
    return res.status(500).json({ error: "Lookup failed.", details: error?.message });
  }
}
