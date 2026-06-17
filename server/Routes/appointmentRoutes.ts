import { Router } from "express";
import { authMiddleware } from "../Controller/authController";
import { getAppointments, createAppointment, updateAppointmentStatus, getBookedSlots } from "../Controller/appointmentController";

const router = Router();

router.use(authMiddleware);
router.get("/",                  getAppointments);
router.post("/",                 createAppointment);
router.patch("/:id/status",      updateAppointmentStatus);
router.get("/booked-slots",      getBookedSlots);

export default router;
