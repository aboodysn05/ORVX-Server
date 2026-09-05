import { Router } from "express";
import authRoutes from "./auth.routes.js";
import playersRoutes from "./players.routes.js";
import drillsRoutes from "./drills.routes.js";
import sessionsRoutes from "./sessions.routes.js";
import clubsRoutes from "./clubs.routes.js";
import competitionsRoutes from "./competitions.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/players", playersRoutes);
router.use("/drills", drillsRoutes);
router.use("/sessions", sessionsRoutes);
router.use("/clubs", clubsRoutes);
router.use("/competitions", competitionsRoutes);

export default router;
