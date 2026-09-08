import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { attachCurrentUser } from "../middleware/loadUser.js";
import {
  submitAssessmentController,
  meController,
  featuredController,
  setRegisteredPositionController,
} from "../controllers/players.controller.js";
import { scoutingPoolController } from "../controllers/clubMemberships.controller.js";
import {
  myClubApplicationsController,
  withdrawMyApplicationController,
} from "../controllers/clubApplications.controller.js";

const router = Router();

// Public — the Hero page's illustrative player card.
router.get("/featured", featuredController);

// Released free agents, for the coach squad manager (Phase 4). Declared before
// "/me" is irrelevant (distinct paths), but before any ":id" route would be.
router.get(
  "/scouting-pool",
  requireAuth,
  attachCurrentUser,
  requireRole("coach", "admin"),
  scoutingPoolController,
);

router.post("/assessment", requireAuth, requireRole("player"), submitAssessmentController);
router.get("/me", requireAuth, requireRole("player"), meController);
router.get("/me/applications", requireAuth, requireRole("player"), myClubApplicationsController);
router.delete(
  "/me/applications/:appId",
  requireAuth,
  requireRole("player"),
  withdrawMyApplicationController,
);

// A club head coach (or admin) changes a rostered player's registered position.
router.patch(
  "/:playerId/registered-position",
  requireAuth,
  attachCurrentUser,
  requireRole("coach", "admin"),
  setRegisteredPositionController,
);

export default router;
