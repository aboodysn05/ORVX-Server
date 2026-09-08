import * as coachesService from "../services/coaches.service.js";

export async function applyController(req, res) {
  const application = await coachesService.applyAsCoach(req.user.id, req.body);
  res.status(201).json({ application });
}

export async function myApplicationController(req, res) {
  const application = await coachesService.getMyCoachApplication(req.user.id);
  res.json({ application });
}

