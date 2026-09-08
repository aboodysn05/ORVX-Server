import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { SQUAD_CAP } from "../utils/constants.js";
import { keysFor } from "../utils/playerRating.js";

// Club rosters and player-to-club applications. A "released" free agent (>= 1
// approved drill submission, not on a roster) can be signed by a club head
// coach up to the squad cap; a signed player's future submissions route to
// that club's coach (see sessions.service.submitSession).

const POSITIONS = ["Attacker", "Defender", "Goalkeeper"];

async function getClub(client, clubId) {
  const result = await client.query("SELECT * FROM clubs WHERE id = $1", [clubId]);
  if (!result.rows[0]) {
    throw new AppError("Club not found.", 404, "CLUB_NOT_FOUND");
  }
  return result.rows[0];
}

// admin bypasses; a coach must be this club's head coach.
async function assertClubCoachOrAdmin(client, clubId, user) {
  const club = await getClub(client, clubId);
  if (club.archived) {
    throw new AppError("This club is archived.", 409, "CLUB_ARCHIVED");
  }
  if (user.role === "admin") return club;
  if (user.coachId != null && club.head_coach_id === user.coachId) return club;
  throw new AppError("You are not this club's head coach.", 403, "NOT_CLUB_COACH");
}

async function getPlayerByUserId(client, userId) {
  const result = await client.query("SELECT * FROM players WHERE user_id = $1", [userId]);
  if (!result.rows[0]) {
    throw new AppError("No player profile yet — complete the assessment first.", 404, "PLAYER_NOT_FOUND");
  }
  return result.rows[0];
}

export async function playerLifecycle(client, playerId) {
  const membership = await client.query(
    "SELECT 1 FROM club_memberships WHERE player_id = $1 AND active LIMIT 1",
    [playerId],
  );
  if (membership.rows.length > 0) return "signed";
  const approved = await client.query(
    "SELECT 1 FROM drill_submissions WHERE player_id = $1 AND review_status = 'approved' LIMIT 1",
    [playerId],
  );
  return approved.rows.length > 0 ? "released" : "baseline_pending";
}

async function attributesByPlayer(client, playerIds) {
  if (playerIds.length === 0) return new Map();
  // Players can carry both attribute sets (see players.service's
  // non-destructive position swap) — only expose the six their current
  // position uses.
  const result = await client.query(
    `SELECT pa.player_id, a.code, pa.value, p.position
     FROM player_attributes pa
     JOIN attributes a ON a.id = pa.attribute_id
     JOIN players p ON p.id = pa.player_id
     WHERE pa.player_id = ANY($1::int[])`,
    [playerIds],
  );
  const map = new Map();
  for (const row of result.rows) {
    if (!keysFor(row.position).includes(row.code)) continue;
    if (!map.has(row.player_id)) map.set(row.player_id, {});
    map.get(row.player_id)[row.code] = row.value;
  }
  return map;
}

function membershipShape(row) {
  return {
    id: row.id,
    clubId: row.club_id,
    playerId: row.player_id,
    position: row.position,
    active: row.active,
    signedAt: row.signed_at,
    releasedAt: row.released_at,
  };
}

export async function getRoster(clubId) {
  const client = await pool.connect();
  try {
    const club = await getClub(client, clubId);
    const result = await client.query(
      `SELECT m.id, m.position AS squad_position, m.signed_at,
              p.id AS player_id, p.position, p.overall, p.tier, p.height_cm, p.weight_kg,
              u.name AS player_name
       FROM club_memberships m
       JOIN players p ON p.id = m.player_id
       JOIN users u ON u.id = p.user_id
       WHERE m.club_id = $1 AND m.active
       ORDER BY m.signed_at`,
      [clubId],
    );
    const attrs = await attributesByPlayer(client, result.rows.map((r) => r.player_id));
    return {
      clubId: club.id,
      clubName: club.name,
      squadCap: SQUAD_CAP,
      count: result.rows.length,
      players: result.rows.map((r) => ({
        playerId: r.player_id,
        name: r.player_name,
        position: r.position,
        squadPosition: r.squad_position,
        overall: r.overall,
        tier: r.tier,
        heightCm: r.height_cm,
        weightKg: r.weight_kg,
        attributes: attrs.get(r.player_id) || {},
        signedAt: r.signed_at,
      })),
    };
  } finally {
    client.release();
  }
}

// Shared by the direct sign endpoint and application-accept.
async function signPlayerCore(client, clubId, playerId, position, decidedBy) {
  const playerResult = await client.query("SELECT id FROM players WHERE id = $1", [playerId]);
  if (!playerResult.rows[0]) {
    throw new AppError("Player not found.", 404, "PLAYER_NOT_FOUND");
  }

  const lifecycle = await playerLifecycle(client, playerId);
  if (lifecycle === "signed") {
    throw new AppError("This player is already on a club roster.", 409, "PLAYER_ALREADY_SIGNED");
  }
  if (lifecycle !== "released") {
    throw new AppError(
      "This player hasn't been released to the scouting pool yet.",
      409,
      "PLAYER_NOT_RELEASED",
    );
  }

  const countResult = await client.query(
    "SELECT count(*)::int AS n FROM club_memberships WHERE club_id = $1 AND active",
    [clubId],
  );
  if (countResult.rows[0].n >= SQUAD_CAP) {
    throw new AppError(`Squad is full (${SQUAD_CAP} players).`, 409, "SQUAD_FULL");
  }

  if (position != null && !POSITIONS.includes(position)) {
    throw new AppError(`position must be one of: ${POSITIONS.join(", ")}.`, 400, "VALIDATION_ERROR");
  }

  let membership;
  try {
    const inserted = await client.query(
      `INSERT INTO club_memberships (club_id, player_id, position, active)
       VALUES ($1, $2, $3, true) RETURNING *`,
      [clubId, playerId, position || null],
    );
    membership = inserted.rows[0];
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("This player is already on a club roster.", 409, "PLAYER_ALREADY_SIGNED");
    }
    throw err;
  }

  // Accept this player's pending application to this club; withdraw the rest.
  await client.query(
    `UPDATE club_applications
     SET status = 'accepted', decided_by = $1, decided_at = now()
     WHERE player_id = $2 AND club_id = $3 AND status = 'pending'`,
    [decidedBy || null, playerId, clubId],
  );
  await client.query(
    `UPDATE club_applications
     SET status = 'withdrawn', decided_at = now()
     WHERE player_id = $1 AND status = 'pending'`,
    [playerId],
  );

  return membership;
}

export async function signPlayer(clubId, actingUser, { playerId, position }) {
  if (!Number.isInteger(playerId)) {
    throw new AppError("playerId is required.", 400, "VALIDATION_ERROR");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertClubCoachOrAdmin(client, clubId, actingUser);
    const membership = await signPlayerCore(client, clubId, playerId, position, actingUser.id);
    await client.query("COMMIT");
    return membershipShape(membership);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function releasePlayer(clubId, actingUser, playerId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertClubCoachOrAdmin(client, clubId, actingUser);
    const result = await client.query(
      `UPDATE club_memberships SET active = false, released_at = now()
       WHERE club_id = $1 AND player_id = $2 AND active RETURNING id`,
      [clubId, playerId],
    );
    if (result.rows.length === 0) {
      throw new AppError("That player is not on this club's active roster.", 404, "MEMBERSHIP_NOT_FOUND");
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateMembershipPosition(clubId, actingUser, playerId, position) {
  if (!POSITIONS.includes(position)) {
    throw new AppError(`position must be one of: ${POSITIONS.join(", ")}.`, 400, "VALIDATION_ERROR");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertClubCoachOrAdmin(client, clubId, actingUser);
    const result = await client.query(
      `UPDATE club_memberships SET position = $1
       WHERE club_id = $2 AND player_id = $3 AND active RETURNING *`,
      [position, clubId, playerId],
    );
    if (result.rows.length === 0) {
      throw new AppError("That player is not on this club's active roster.", 404, "MEMBERSHIP_NOT_FOUND");
    }
    await client.query("COMMIT");
    return membershipShape(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getScoutingPool() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT p.id AS player_id, p.position, p.overall, p.tier, p.height_cm, p.weight_kg,
              u.name AS player_name,
              (SELECT max(a.reviewed_at) FROM drill_submissions a
               WHERE a.player_id = p.id AND a.review_status = 'approved') AS released_at
       FROM players p
       JOIN users u ON u.id = p.user_id
       WHERE EXISTS (SELECT 1 FROM drill_submissions a
                     WHERE a.player_id = p.id AND a.review_status = 'approved')
         AND NOT EXISTS (SELECT 1 FROM club_memberships m
                         WHERE m.player_id = p.id AND m.active)
       ORDER BY released_at DESC NULLS LAST`,
    );
    const attrs = await attributesByPlayer(client, result.rows.map((r) => r.player_id));
    return {
      players: result.rows.map((r) => ({
        playerId: r.player_id,
        name: r.player_name,
        position: r.position,
        overall: r.overall,
        tier: r.tier,
        heightCm: r.height_cm,
        weightKg: r.weight_kg,
        attributes: attrs.get(r.player_id) || {},
        releasedAt: r.released_at,
      })),
    };
  } finally {
    client.release();
  }
}

export async function applyToClub(userId, clubId, { message } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const player = await getPlayerByUserId(client, userId);
    const club = await getClub(client, clubId);
    if (club.archived) {
      throw new AppError("This club is archived.", 409, "CLUB_ARCHIVED");
    }

    const lifecycle = await playerLifecycle(client, player.id);
    if (lifecycle === "signed") {
      throw new AppError("You're already on a club roster.", 409, "ALREADY_SIGNED");
    }
    if (lifecycle !== "released") {
      throw new AppError(
        "Get your baseline session approved before applying to clubs.",
        409,
        "NOT_RELEASED",
      );
    }

    let application;
    try {
      const result = await client.query(
        `INSERT INTO club_applications (club_id, player_id, message)
         VALUES ($1, $2, $3) RETURNING *`,
        [clubId, player.id, message || null],
      );
      application = result.rows[0];
    } catch (err) {
      if (err.code === "23505") {
        throw new AppError("You already have a pending club application.", 409, "APPLICATION_PENDING");
      }
      throw err;
    }
    await client.query("COMMIT");
    return {
      id: application.id,
      clubId: application.club_id,
      playerId: application.player_id,
      message: application.message,
      status: application.status,
      createdAt: application.created_at,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// The player pulls their own still-pending application. Accepted/declined ones
// are final; withdrawing frees the one-pending-per-player slot so they can
// apply elsewhere.
export async function withdrawClubApplication(userId, appId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const player = await getPlayerByUserId(client, userId);
    const found = await client.query("SELECT * FROM club_applications WHERE id = $1", [appId]);
    const app = found.rows[0];
    if (!app || app.player_id !== player.id) {
      throw new AppError("Application not found.", 404, "APPLICATION_NOT_FOUND");
    }
    if (app.status !== "pending") {
      throw new AppError("Only a pending application can be withdrawn.", 409, "APPLICATION_NOT_PENDING");
    }
    const updated = await client.query(
      `UPDATE club_applications SET status = 'withdrawn', decided_at = now()
       WHERE id = $1 RETURNING *`,
      [appId],
    );
    await client.query("COMMIT");
    const r = updated.rows[0];
    return { id: r.id, clubId: r.club_id, status: r.status, decidedAt: r.decided_at };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listMyClubApplications(userId) {
  const client = await pool.connect();
  try {
    const player = await getPlayerByUserId(client, userId);
    const result = await client.query(
      `SELECT ca.id, ca.club_id, ca.message, ca.status, ca.created_at, ca.decided_at,
              cl.name AS club_name
       FROM club_applications ca
       JOIN clubs cl ON cl.id = ca.club_id
       WHERE ca.player_id = $1
       ORDER BY ca.created_at DESC`,
      [player.id],
    );
    return result.rows.map((r) => ({
      id: r.id,
      clubId: r.club_id,
      clubName: r.club_name,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
    }));
  } finally {
    client.release();
  }
}

export async function listClubApplications(clubId, actingUser) {
  const client = await pool.connect();
  try {
    await assertClubCoachOrAdmin(client, clubId, actingUser);
    const result = await client.query(
      `SELECT ca.id, ca.player_id, ca.message, ca.status, ca.created_at,
              p.position, p.overall, p.tier, u.name AS player_name
       FROM club_applications ca
       JOIN players p ON p.id = ca.player_id
       JOIN users u ON u.id = p.user_id
       WHERE ca.club_id = $1
       ORDER BY ca.created_at DESC`,
      [clubId],
    );
    return result.rows.map((r) => ({
      id: r.id,
      playerId: r.player_id,
      playerName: r.player_name,
      position: r.position,
      overall: r.overall,
      tier: r.tier,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
    }));
  } finally {
    client.release();
  }
}

export async function decideClubApplication(clubId, appId, actingUser, decision) {
  if (decision !== "accept" && decision !== "decline") {
    throw new AppError('decision must be "accept" or "decline".', 400, "VALIDATION_ERROR");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertClubCoachOrAdmin(client, clubId, actingUser);

    const appResult = await client.query(
      "SELECT * FROM club_applications WHERE id = $1 AND club_id = $2 FOR UPDATE",
      [appId, clubId],
    );
    const application = appResult.rows[0];
    if (!application) {
      throw new AppError("Club application not found.", 404, "APPLICATION_NOT_FOUND");
    }
    if (application.status !== "pending") {
      throw new AppError("This application has already been decided.", 409, "APPLICATION_NOT_PENDING");
    }

    if (decision === "decline") {
      const updated = await client.query(
        `UPDATE club_applications SET status = 'declined', decided_by = $1, decided_at = now()
         WHERE id = $2 RETURNING *`,
        [actingUser.id, appId],
      );
      await client.query("COMMIT");
      return { application: shapeAppRow(updated.rows[0]), membership: null };
    }

    // accept -> sign (runs cap + lifecycle checks, marks this app accepted)
    const membership = await signPlayerCore(
      client,
      clubId,
      application.player_id,
      null,
      actingUser.id,
    );
    const updated = await client.query("SELECT * FROM club_applications WHERE id = $1", [appId]);
    await client.query("COMMIT");
    return { application: shapeAppRow(updated.rows[0]), membership: membershipShape(membership) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function shapeAppRow(row) {
  return {
    id: row.id,
    clubId: row.club_id,
    playerId: row.player_id,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}
