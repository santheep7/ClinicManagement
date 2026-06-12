import { Router } from "express";
import { authMiddleware } from "../Controller/authController";
import { createPatient, getPatients, getPatientById, updatePatient, deletePatient } from "../Controller/patientController";

const router = Router();

router.use(authMiddleware);
router.get("/", getPatients);
router.get("/:id", getPatientById);
router.post("/", createPatient);
router.patch("/:id", updatePatient);
router.delete("/:id", deletePatient);

export default router;
