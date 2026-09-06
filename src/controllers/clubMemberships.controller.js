import { AppError } from "../utils/AppError.js";
import * as memberships from "../services/clubMemberships.service.js";

function clubId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("Invalid club id.", 400, "VALIDATION_ERROR");
  return id;
}
function playerId(req) {
  const id = Number(req.params.playerId);
  if (!Number.isInteger(id)) throw new AppError("Invalid player id.", 400, "VALIDATION_ERROR");
  return id;
}

export async function getRosterController(req, res) {
  res.json(await memberships.getRoster(clubId(req)));
}

export async function signPlayerController(req, res) {
  const membership = await memberships.signPlayer(clubId(req), req.currentUser, {
    playerId: Number(req.body.playerId),
    position: req.body.position,
  });
  res.status(201).json({ membership });
}

export async function updatePositionController(req, res) {
  const membership = await memberships.updateMembershipPosition(
    clubId(req),
    req.currentUser,
    playerId(req),
    req.body.position,
  );
  res.json({ membership });
}

export async function releasePlayerController(req, res) {
  await memberships.releasePlayer(clubId(req), req.currentUser, playerId(req));
  res.status(204).end();
}

export async function scoutingPoolController(req, res) {
  res.json(await memberships.getScoutingPool());
}
