import * as drillsService from "../services/drills.service.js";

export async function listDrillsController(req, res) {
  const drills = await drillsService.listDrills();
  res.json({ drills });
}
