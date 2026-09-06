import { AppError } from "../utils/AppError.js";
import * as adminClubs from "../services/adminClubs.service.js";

function clubId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("Invalid club id.", 400, "VALIDATION_ERROR");
  return id;
}

export async function listController(req, res) {
  const clubs = await adminClubs.listClubsAdmin();
  res.json({ clubs });
}

export async function provisionController(req, res) {
  const club = await adminClubs.provisionClub(req.body);
  res.status(201).json({ club });
}

export async function archiveController(req, res) {
  const club = await adminClubs.archiveClub(clubId(req));
  res.json({ club });
}

export async function restoreController(req, res) {
  const club = await adminClubs.restoreClub(clubId(req));
  res.json({ club });
}
