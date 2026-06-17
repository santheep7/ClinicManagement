import { Router } from "express";
import { authMiddleware, getMe, getDoctors, login, register, getClinicByEmployeeId } from "../Controller/authController";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.get("/doctors", authMiddleware, getDoctors);
router.get("/clinic-by-employee/:employeeId", getClinicByEmployeeId);

export default router;
