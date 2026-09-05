import * as competitionsService from "../services/competitions.service.js";

export async function listCompetitionsController(req, res) {
  const competitions = await competitionsService.listCompetitions();
  res.json({ competitions });
}

export async function getStandingsController(req, res) {
  const standings = await competitionsService.getStandings(Number(req.params.id));
  res.json({ standings });
}

export async function getFixturesController(req, res) {
  const fixtures = await competitionsService.getFixtures(Number(req.params.id));
  res.json({ fixtures });
}

export async function getBracketController(req, res) {
  const bracket = await competitionsService.getBracket(Number(req.params.id));
  res.json(bracket);
}
