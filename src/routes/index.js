import { Router } from "express";
import authRoutes from "./auth.routes.js";
import playersRoutes from "./players.routes.js";
import drillsRoutes from "./drills.routes.js";
import sessionsRoutes from "./sessions.routes.js";
import clubsRoutes from "./clubs.routes.js";
import competitionsRoutes from "./competitions.routes.js";
import reviewRoutes from "./review.routes.js";
import coachesRoutes from "./coaches.routes.js";
import adminRoutes from "./admin.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/players", playersRoutes);
router.use("/drills", drillsRoutes);
router.use("/sessions", sessionsRoutes);
router.use("/clubs", clubsRoutes);
router.use("/competitions", competitionsRoutes);
router.use("/review", reviewRoutes);
router.use("/coaches", coachesRoutes);
router.use("/admin", adminRoutes);

export default router;
