import { AppError } from "../utils/AppError.js";
import * as clubsService from "../services/clubs.service.js";
import * as clubOverviewService from "../services/clubOverview.service.js";

export async function listClubsController(req, res) {
  const clubs = await clubsService.listClubs();
  res.json({ clubs });
}

export async function getClubOverviewController(req, res) {
  const clubId = Number(req.params.id);
  if (!Number.isInteger(clubId)) {
    throw new AppError("Invalid club id.", 400, "VALIDATION_ERROR");
  }
  const overview = await clubOverviewService.getClubOverview(clubId);
  res.json({ overview });
}
