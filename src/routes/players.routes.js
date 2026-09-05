import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { submitAssessmentController, meController } from "../controllers/players.controller.js";

const router = Router();

router.post("/assessment", requireAuth, requireRole("player"), submitAssessmentController);
router.get("/me", requireAuth, requireRole("player"), meController);

export default router;
