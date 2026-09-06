import { AppError } from "../utils/AppError.js";
import * as drillsService from "../services/drills.service.js";

function drillId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("Invalid drill id.", 400, "VALIDATION_ERROR");
  return id;
}

export async function listController(req, res) {
  const drills = await drillsService.listDrills({ includeInactive: true });
  res.json({ drills });
}

export async function createController(req, res) {
  const drill = await drillsService.createDrill(req.body);
  res.status(201).json({ drill });
}

export async function updateController(req, res) {
  const drill = await drillsService.updateDrill(drillId(req), req.body);
  res.json({ drill });
}

export async function retireController(req, res) {
  const drill = await drillsService.setDrillActive(drillId(req), false);
  res.json({ drill });
}

export async function reinstateController(req, res) {
  const drill = await drillsService.setDrillActive(drillId(req), true);
  res.json({ drill });
}
