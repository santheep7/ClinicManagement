import { Router } from "express";
import { authMiddleware } from "../Controller/authController";
import { getVitalConfigs, upsertVitalConfig, deleteVitalConfig } from "../Controller/vitalConfigController";

const router = Router();

router.use(authMiddleware);

router.get("/", getVitalConfigs);
router.post("/", upsertVitalConfig);
router.delete("/:department", deleteVitalConfig);

export default router;
