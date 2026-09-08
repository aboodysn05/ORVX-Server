import { AppError } from "../utils/AppError.js";
import * as reviewService from "../services/review.service.js";

export async function getReviewQueueController(req, res) {
  const result = await reviewService.getReviewQueue(req.currentUser);
  res.json(result);
}

export async function getReviewStatsController(req, res) {
  const stats = await reviewService.getReviewStats(req.currentUser);
  res.json({ stats });
}

export async function reviewSubmissionController(req, res) {
  const submissionId = Number(req.params.id);
  if (!Number.isInteger(submissionId)) {
    throw new AppError("Invalid submission id.", 400, "VALIDATION_ERROR");
  }
  const { verdict, feedback, verifiedAttributes } = req.body;
  if (!verdict) {
    throw new AppError("verdict is required.", 400, "VALIDATION_ERROR");
  }
  const result = await reviewService.reviewSubmission({
    submissionId,
    reviewer: req.currentUser,
    verdict,
    feedback,
    verifiedAttributes,
  });
  res.json(result);
}
