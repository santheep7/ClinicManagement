import { Router } from "express";
import {
  addClinic,
  getActiveClinics,
  getAllClinics,
  updateClinic,
  getClinicStaff,
} from "../Controller/clinicController";

const router = Router();

// Public — used by login page to show clinic branding
router.get("/", getActiveClinics);

// Admin — full list including inactive
router.get("/admin/all", getAllClinics);

// Admin — create clinic
router.post("/", addClinic);

// Admin — update clinic name, address, phone, logo, brandColor, isActive
router.patch("/:id", updateClinic);

// Admin — staff for a specific clinic
router.get("/:id/staff", getClinicStaff);

export default router;