import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listDrillsController } from "../controllers/drills.controller.js";

const router = Router();

// Any authenticated role can browse the catalog — players to build sessions,
// coaches/admins to see what exists before the write endpoints (CRUD) land.
router.get("/", requireAuth, listDrillsController);

export default router;
