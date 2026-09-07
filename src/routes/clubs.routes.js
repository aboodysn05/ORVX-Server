import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { attachCurrentUser } from "../middleware/loadUser.js";
import {
  listClubsController,
  getClubOverviewController,
} from "../controllers/clubs.controller.js";
import {
  getRosterController,
  signPlayerController,
  updatePositionController,
  releasePlayerController,
} from "../controllers/clubMemberships.controller.js";
import {
  applyToClubController,
  listClubApplicationsController,
  acceptApplicationController,
  declineApplicationController,
} from "../controllers/clubApplications.controller.js";

const router = Router();

// Public — club names/crests aren't sensitive, and the pages that show them
// (Hero stats, Leagues standings) have no login wall.
router.get("/", listClubsController);

// Aggregate for the Coach Club Profile page.
router.get("/:id/overview", requireAuth, attachCurrentUser, getClubOverviewController);

// --- roster (Phase 4) ---
router.get("/:id/roster", requireAuth, attachCurrentUser, getRosterController);
router.post(
  "/:id/roster",
  requireAuth,
  attachCurrentUser,
  requireRole("coach", "admin"),
  signPlayerController,
);
router.patch(
  "/:id/roster/:playerId",
  requireAuth,
  attachCurrentUser,
  requireRole("coach", "admin"),
  updatePositionController,
);
router.delete(
  "/:id/roster/:playerId",
  requireAuth,
  attachCurrentUser,
  requireRole("coach", "admin"),
  releasePlayerController,
);

// --- club applications (Phase 4) ---
router.get(
  "/:id/applications",
  requireAuth,
  attachCurrentUser,
  requireRole("coach", "admin"),
  listClubApplicationsController,
);
router.post(
  "/:id/applications",
  requireAuth,
  attachCurrentUser,
  requireRole("player"),
  applyToClubController,
);
router.post(
  "/:id/applications/:appId/accept",
  requireAuth,
  attachCurrentUser,
  requireRole("coach", "admin"),
  acceptApplicationController,
);
router.post(
  "/:id/applications/:appId/decline",
  requireAuth,
  attachCurrentUser,
  requireRole("coach", "admin"),
  declineApplicationController,
);

export default router;
