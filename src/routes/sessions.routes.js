import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  createSessionController,
  getActiveSessionController,
  saveProgressController,
  completeSessionController,
  discardSessionController,
  submitSessionController,
  listSessionsController,
} from "../controllers/sessions.controller.js";

const router = Router();

router.use(requireAuth, requireRole("player"));

router.post("/", createSessionController);
router.get("/active", getActiveSessionController);
router.get("/", listSessionsController);
router.patch("/:id/progress", saveProgressController);
router.post("/:id/complete", completeSessionController);
router.post("/:id/submit", submitSessionController);
router.delete("/:id", discardSessionController);

export default router;
