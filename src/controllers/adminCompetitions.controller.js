import { AppError } from "../utils/AppError.js";
import * as competitionsService from "../services/competitions.service.js";

function idParam(req, key, label) {
  const id = Number(req.params[key]);
  if (!Number.isInteger(id)) throw new AppError(`Invalid ${label} id.`, 400, "VALIDATION_ERROR");
  return id;
}

export async function updateCompetitionController(req, res) {
  const competition = await competitionsService.updateCompetition(
    idParam(req, "id", "competition"),
    req.body,
  );
  res.json({ competition });
}

export async function generateLeagueFixturesController(req, res) {
  const result = await competitionsService.generateLeagueFixtures(
    idParam(req, "id", "competition"),
    req.body,
  );
  res.status(201).json(result);
}

export async function generateKnockoutBracketController(req, res) {
  const result = await competitionsService.generateKnockoutBracket(
    idParam(req, "id", "competition"),
    req.body,
  );
  res.status(201).json(result);
}

export async function advanceKnockoutController(req, res) {
  const result = await competitionsService.advanceKnockout(idParam(req, "id", "competition"), req.body);
  res.status(201).json(result);
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
