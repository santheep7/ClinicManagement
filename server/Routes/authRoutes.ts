import { Router } from "express";
import { authMiddleware, getMe, getDoctors, login, register } from "../Controller/authController";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.get("/doctors", authMiddleware, getDoctors);

export default router;
