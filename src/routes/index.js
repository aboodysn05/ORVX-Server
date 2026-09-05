import { Router } from "express";
import authRoutes from "./auth.routes.js";
import playersRoutes from "./players.routes.js";
import drillsRoutes from "./drills.routes.js";
import sessionsRoutes from "./sessions.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/players", playersRoutes);
router.use("/drills", drillsRoutes);
router.use("/sessions", sessionsRoutes);

export default router;
