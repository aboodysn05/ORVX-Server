import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { attachCurrentUser } from "../middleware/loadUser.js";
import {
  getReviewQueueController,
  reviewSubmissionController,
} from "../controllers/review.controller.js";

const router = Router();

// Reviewers are coaches (Platform Evaluator now, club coaches from Phase 4) and
// admins. attachCurrentUser is needed for the organization / coach identity.
router.use(requireAuth, attachCurrentUser, requireRole("coach", "admin"));

router.get("/queue", getReviewQueueController);
router.post("/submissions/:id", reviewSubmissionController);

export default router;
