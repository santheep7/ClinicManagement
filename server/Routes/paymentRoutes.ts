import { Router } from "express";
import { getPayments, addPayment, deletePayment } from "../Controller/paymentcontroller";
import { authMiddleware } from  "../Controller/authController"; // adjust path if needed

const router = Router();

router.get(   "/",    authMiddleware, getPayments   );
router.post(  "/",    authMiddleware, addPayment    );
router.delete("/:id", authMiddleware, deletePayment );

export default router;