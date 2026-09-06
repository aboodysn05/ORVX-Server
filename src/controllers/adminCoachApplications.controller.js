import { AppError } from "../utils/AppError.js";
import * as coachesService from "../services/coaches.service.js";

function idParam(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new AppError("Invalid application id.", 400, "VALIDATION_ERROR");
  }
  return id;
}

export async function listController(req, res) {
  const applications = await coachesService.listCoachApplications({ status: req.query.status });
  res.json({ applications });
}

export async function getController(req, res) {
  const application = await coachesService.getCoachApplication(idParam(req));
  res.json({ application });
}

export async function approveController(req, res) {
  const result = await coachesService.approveCoachApplication(idParam(req), req.user.id);
  res.json(result);
}

export async function declineController(req, res) {
  const application = await coachesService.declineCoachApplication(
    idParam(req),
    req.user.id,
    req.body?.note,
  );
  res.json({ application });
}
