import * as clubsService from "../services/clubs.service.js";

export async function listClubsController(req, res) {
  const clubs = await clubsService.listClubs();
  res.json({ clubs });
}
