import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { submitAssessmentController, meController, featuredController } from "../controllers/players.controller.js";

const router = Router();

// Public — the Hero page's illustrative player card.
router.get("/featured", featuredController);

router.post("/assessment", requireAuth, requireRole("player"), submitAssessmentController);
router.get("/me", requireAuth, requireRole("player"), meController);

export default router;
