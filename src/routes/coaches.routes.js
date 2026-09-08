import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  applyController,
  myApplicationController,
} from "../controllers/coaches.controller.js";

const router = Router();

router.post("/applications", requireAuth, requireRole("coach"), applyController);
router.get("/applications/me", requireAuth, requireRole("coach"), myApplicationController);

export default router;
