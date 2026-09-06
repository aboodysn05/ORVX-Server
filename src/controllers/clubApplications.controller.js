import { AppError } from "../utils/AppError.js";
import * as memberships from "../services/clubMemberships.service.js";

function clubId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("Invalid club id.", 400, "VALIDATION_ERROR");
  return id;
}
function appId(req) {
  const id = Number(req.params.appId);
  if (!Number.isInteger(id)) throw new AppError("Invalid application id.", 400, "VALIDATION_ERROR");
  return id;
}

export async function applyToClubController(req, res) {
  const application = await memberships.applyToClub(req.user.id, clubId(req), {
    message: req.body?.message,
  });
  res.status(201).json({ application });
}

export async function myClubApplicationsController(req, res) {
  const applications = await memberships.listMyClubApplications(req.user.id);
  res.json({ applications });
}

export async function listClubApplicationsController(req, res) {
  const applications = await memberships.listClubApplications(clubId(req), req.currentUser);
  res.json({ applications });
}

export async function acceptApplicationController(req, res) {
  const result = await memberships.decideClubApplication(
    clubId(req),
    appId(req),
    req.currentUser,
    "accept",
  );
  res.json(result);
}

export async function declineApplicationController(req, res) {
  const result = await memberships.decideClubApplication(
    clubId(req),
    appId(req),
    req.currentUser,
    "decline",
  );
  res.json(result);
}
