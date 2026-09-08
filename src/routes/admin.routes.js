import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { attachCurrentUser } from "../middleware/loadUser.js";
import {
  listController as listCoachApplicationsController,
  getController as getCoachApplicationController,
  approveController as approveCoachApplicationController,
  declineController as declineCoachApplicationController,
} from "../controllers/adminCoachApplications.controller.js";
import {
  listController as listDrillsController,
  createController as createDrillController,
  updateController as updateDrillController,
  retireController as retireDrillController,
  reinstateController as reinstateDrillController,
} from "../controllers/adminDrills.controller.js";
import {
  updateCompetitionController,
  generateLeagueFixturesController,
  generateKnockoutBracketController,
  advanceKnockoutController,
  createMatchController,
  updateMatchController,
  deleteMatchController,
} from "../controllers/adminCompetitions.controller.js";
import {
  listController as listClubsController,
  provisionController as provisionClubController,
  archiveController as archiveClubController,
  restoreController as restoreClubController,
} from "../controllers/adminClubs.controller.js";
import { getAdminOverviewController } from "../controllers/adminOverview.controller.js";

const router = Router();

// Every admin-console endpoint lives here, behind an admin-role gate.
router.use(requireAuth, attachCurrentUser, requireRole("admin"));

// --- console landing aggregate ---
router.get("/overview", getAdminOverviewController);

// --- coach onboarding queue (Phase 3) ---
router.get("/coach-applications", listCoachApplicationsController);
router.get("/coach-applications/:id", getCoachApplicationController);
router.post("/coach-applications/:id/approve", approveCoachApplicationController);
router.post("/coach-applications/:id/decline", declineCoachApplicationController);

// --- drill catalogue (Phase 5) ---
router.get("/drills", listDrillsController);
router.post("/drills", createDrillController);
router.patch("/drills/:id", updateDrillController);
router.post("/drills/:id/retire", retireDrillController);
router.post("/drills/:id/reinstate", reinstateDrillController);

// --- competition engine (Phase 6) ---
router.patch("/competitions/:id", updateCompetitionController);
router.post("/competitions/:id/fixtures/generate", generateLeagueFixturesController);
router.post("/competitions/:id/bracket/generate", generateKnockoutBracketController);
router.post("/competitions/:id/bracket/advance", advanceKnockoutController);
router.post("/competitions/:id/matches", createMatchController);
router.patch("/matches/:id", updateMatchController);
router.delete("/matches/:id", deleteMatchController);

// --- club allocation (Phase 7) ---
router.get("/clubs", listClubsController);
router.post("/clubs", provisionClubController);
router.post("/clubs/:id/archive", archiveClubController);
router.post("/clubs/:id/restore", restoreClubController);

export default router;
