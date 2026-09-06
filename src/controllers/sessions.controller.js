import { AppError } from "../utils/AppError.js";
import * as sessionsService from "../services/sessions.service.js";

export async function createSessionController(req, res) {
  const { name, focus, drills } = req.body;
  const session = await sessionsService.createSession(req.user.id, { name, focus, drills });
  res.status(201).json({ session });
}

export async function getActiveSessionController(req, res) {
  const session = await sessionsService.getActiveSession(req.user.id);
  res.json({ session });
}

export async function saveProgressController(req, res) {
  const { progress } = req.body;
  const session = await sessionsService.saveProgress(req.user.id, Number(req.params.id), progress);
  res.json({ session });
}

export async function completeSessionController(req, res) {
  const session = await sessionsService.completeSession(req.user.id, Number(req.params.id));
  res.json({ session });
}

export async function discardSessionController(req, res) {
  await sessionsService.discardSession(req.user.id, Number(req.params.id));
  res.status(204).send();
}

export async function submitSessionController(req, res) {
  const { videoUrl, notes, reviewerName, reviewerCoachId } = req.body;
  if (!videoUrl) {
    throw new AppError("videoUrl is required.", 400, "VALIDATION_ERROR");
  }
  const session = await sessionsService.submitSession(req.user.id, Number(req.params.id), {
    videoUrl,
    notes,
    reviewerName,
    reviewerCoachId,
  });
  res.json({ session });
}

export async function listSessionsController(req, res) {
  const sessions = await sessionsService.listSessions(req.user.id, req.query.status);
  res.json({ sessions });
}
