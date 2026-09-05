import { Router } from "express";
import { listDrillsController } from "../controllers/drills.controller.js";

const router = Router();

// Public — the marketing Drills Explorer page has no login wall, and
// browsing the catalog isn't sensitive data.
router.get("/", listDrillsController);

export default router;
