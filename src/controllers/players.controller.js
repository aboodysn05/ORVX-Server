import { AppError } from "../utils/AppError.js";
import * as playersService from "../services/players.service.js";

export async function submitAssessmentController(req, res) {
  const { position, dominantFoot, heightCm, weightKg, attributes } = req.body;

  if (!position || !dominantFoot || heightCm == null || weightKg == null || !attributes) {
    throw new AppError(
      "position, dominantFoot, heightCm, weightKg and attributes are all required.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const player = await playersService.submitAssessment(req.user.id, {
    position,
    dominantFoot,
    heightCm,
    weightKg,
    attributes,
  });
  res.status(201).json({ player });
}

export async function meController(req, res) {
  const player = await playersService.getProfileByUserId(req.user.id);
  res.json({ player });
}

export async function featuredController(req, res) {
  const player = await playersService.getFeaturedPlayer();
  res.json({ player });
}
