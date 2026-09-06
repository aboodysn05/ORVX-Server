import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  applyController,
  myApplicationController,
  listCoachesController,
} from "../controllers/coaches.controller.js";

const router = Router();

// The head-coach directory powers the player's reviewer picker — any signed-in
// user may read it.
router.get("/", requireAuth, listCoachesController);

router.post("/applications", requireAuth, requireRole("coach"), applyController);
router.get("/applications/me", requireAuth, requireRole("coach"), myApplicationController);

export default router;
