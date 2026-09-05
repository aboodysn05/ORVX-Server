import { Router } from "express";
import { listClubsController } from "../controllers/clubs.controller.js";

const router = Router();

// Public — club names/crests aren't sensitive, and the pages that show them
// (Hero stats, Leagues standings) have no login wall.
router.get("/", listClubsController);

export default router;
