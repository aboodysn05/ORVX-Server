import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  registerController,
  loginController,
  meController,
  updateMeController,
} from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.get("/me", requireAuth, meController);
router.patch("/me", requireAuth, updateMeController);

export default router;
