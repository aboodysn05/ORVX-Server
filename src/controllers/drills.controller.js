import * as drillsService from "../services/drills.service.js";

export async function listDrillsController(req, res) {
  // The public / player-facing catalogue is active drills only.
  const drills = await drillsService.listDrills({ includeInactive: false });
  res.json({ drills });
}
