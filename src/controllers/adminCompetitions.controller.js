import { AppError } from "../utils/AppError.js";
import * as competitionsService from "../services/competitions.service.js";

function idParam(req, key, label) {
  const id = Number(req.params[key]);
  if (!Number.isInteger(id)) throw new AppError(`Invalid ${label} id.`, 400, "VALIDATION_ERROR");
  return id;
}

export async function createCompetitionController(req, res) {
  const competition = await competitionsService.createCompetition(req.body);
  res.status(201).json({ competition });
}

export async function updateCompetitionController(req, res) {
  const competition = await competitionsService.updateCompetition(
    idParam(req, "id", "competition"),
    req.body,
  );
  res.json({ competition });
}

export async function deleteCompetitionController(req, res) {
  const result = await competitionsService.deleteCompetition(idParam(req, "id", "competition"));
  res.json(result);
}

export async function createMatchController(req, res) {
  const match = await competitionsService.createMatch(idParam(req, "id", "competition"), req.body);
  res.status(201).json({ match });
}

export async function updateMatchController(req, res) {
  const match = await competitionsService.updateMatch(idParam(req, "id", "match"), req.body);
  res.json({ match });
}

export async function deleteMatchController(req, res) {
  await competitionsService.deleteMatch(idParam(req, "id", "match"));
  res.status(204).end();
}
