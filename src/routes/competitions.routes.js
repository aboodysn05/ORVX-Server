import { Router } from "express";
import {
  listCompetitionsController,
  getStandingsController,
  getFixturesController,
  getBracketController,
} from "../controllers/competitions.controller.js";

const router = Router();

// Public — the Leagues page has no login wall, and standings/fixtures/
// brackets aren't sensitive data.
router.get("/", listCompetitionsController);
router.get("/:id/standings", getStandingsController);
router.get("/:id/fixtures", getFixturesController);
router.get("/:id/bracket", getBracketController);

export default router;
