import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { keysFor, tierFor, computeOverall } from "../utils/playerRating.js";

const POSITIONS = ["Attacker", "Defender", "Goalkeeper"];
const FEET = ["Left", "Right", "Both"];

function validateAssessmentInput({ position, dominantFoot, heightCm, weightKg, attributes }) {
  if (!POSITIONS.includes(position)) {
    throw new AppError(`Position must be one of: ${POSITIONS.join(", ")}.`, 400, "VALIDATION_ERROR");
  }
  if (!FEET.includes(dominantFoot)) {
    throw new AppError(`Dominant foot must be one of: ${FEET.join(", ")}.`, 400, "VALIDATION_ERROR");
  }
  if (!Number.isInteger(heightCm) || heightCm < 100 || heightCm > 230) {
    throw new AppError("Height must be a whole number of centimeters between 100 and 230.", 400, "VALIDATION_ERROR");
  }
  if (!Number.isInteger(weightKg) || weightKg < 30 || weightKg > 150) {
    throw new AppError("Weight must be a whole number of kilograms between 30 and 150.", 400, "VALIDATION_ERROR");
  }

  const expectedKeys = keysFor(position);
  const givenKeys = Object.keys(attributes || {});
  const hasExactKeys =
    givenKeys.length === expectedKeys.length && expectedKeys.every((key) => givenKeys.includes(key));
  if (!hasExactKeys) {
    throw new AppError(
      `Attributes must include exactly: ${expectedKeys.join(", ")}.`,
      400,
      "VALIDATION_ERROR",
    );
  }
  for (const key of expectedKeys) {
    const value = attributes[key];
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new AppError(`Attribute "${key}" must be a whole number between 0 and 100.`, 400, "VALIDATION_ERROR");
    }
  }
}

function toPublicProfile(playerRow, attributeRows) {
  const attributes = {};
  for (const row of attributeRows) {
    attributes[row.code] = row.value;
  }
  return {
    position: playerRow.position,
    dominantFoot: playerRow.dominant_foot,
    heightCm: playerRow.height_cm,
    weightKg: playerRow.weight_kg,
    attributes,
    overall: playerRow.overall,
    tier: playerRow.tier,
  };
}

// Creates the player's profile on first submission, or overwrites it on a
// retake — one player has at most one profile (players.user_id is unique).
export async function submitAssessment(userId, input) {
  validateAssessmentInput(input);

  const { position, dominantFoot, heightCm, weightKg, attributes } = input;
  const keys = keysFor(position);
  // Recomputed server-side, never trusted from the client, so a player can't
  // just POST a high overall/tier alongside low attribute values.
  const overall = computeOverall(position, attributes);
  const tier = tierFor(overall);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const playerResult = await client.query(
      `INSERT INTO players (user_id, position, dominant_foot, height_cm, weight_kg, overall, tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         position = EXCLUDED.position,
         dominant_foot = EXCLUDED.dominant_foot,
         height_cm = EXCLUDED.height_cm,
         weight_kg = EXCLUDED.weight_kg,
         overall = EXCLUDED.overall,
         tier = EXCLUDED.tier
       RETURNING *`,
      [userId, position, dominantFoot, heightCm, weightKg, overall, tier],
    );
    const player = playerResult.rows[0];

    // A retake can switch position (e.g. Attacker -> Goalkeeper), which swaps
    // the whole attribute set — replace rather than upsert so the old
    // position's attributes don't linger alongside the new ones.
    await client.query("DELETE FROM player_attributes WHERE player_id = $1", [player.id]);

    const attributeRows = [];
    for (const key of keys) {
      const result = await client.query(
        `INSERT INTO player_attributes (player_id, attribute_id, value)
         SELECT $1, attributes.id, $3 FROM attributes WHERE attributes.code = $2
         RETURNING (SELECT code FROM attributes WHERE id = attribute_id) AS code, value`,
        [player.id, key, attributes[key]],
      );
      attributeRows.push(result.rows[0]);
    }

    await client.query("COMMIT");
    return toPublicProfile(player, attributeRows);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Public — powers the Hero page's illustrative player card. The "featured"
// player is just whoever completed their assessment most recently; there's
// no ranking/curation logic. Returns null (not a 404) when no player has
// completed the assessment yet, since that's a normal, expected state for a
// public marketing page, not an error.
export async function getFeaturedPlayer() {
  const playerResult = await pool.query(
    `SELECT players.*, users.name AS user_name
     FROM players
     JOIN users ON users.id = players.user_id
     ORDER BY players.created_at DESC
     LIMIT 1`,
  );
  const player = playerResult.rows[0];
  if (!player) return null;

  const attributeRows = await pool.query(
    `SELECT attributes.code, player_attributes.value
     FROM player_attributes
     JOIN attributes ON attributes.id = player_attributes.attribute_id
     WHERE player_attributes.player_id = $1`,
    [player.id],
  );

  return { name: player.user_name, ...toPublicProfile(player, attributeRows.rows) };
}

export async function getProfileByUserId(userId) {
  const playerResult = await pool.query("SELECT * FROM players WHERE user_id = $1", [userId]);
  const player = playerResult.rows[0];
  if (!player) {
    // The "unassessed" lifecycle state — the frontend redirects to /assessment.
    throw new AppError("No player profile yet — complete the assessment first.", 404, "PLAYER_NOT_FOUND");
  }

  const attributeRows = await pool.query(
    `SELECT attributes.code, player_attributes.value
     FROM player_attributes
     JOIN attributes ON attributes.id = player_attributes.attribute_id
     WHERE player_attributes.player_id = $1`,
    [player.id],
  );

  const approvedResult = await pool.query(
    "SELECT count(*)::int AS n FROM drill_submissions WHERE player_id = $1 AND review_status = 'approved'",
    [player.id],
  );
  const approvedCount = approvedResult.rows[0].n;

  const membershipResult = await pool.query(
    `SELECT cl.id, cl.name
     FROM club_memberships m
     JOIN clubs cl ON cl.id = m.club_id
     WHERE m.player_id = $1 AND m.active`,
    [player.id],
  );
  const membership = membershipResult.rows[0] || null;

  const lifecycleState = membership
    ? "signed"
    : approvedCount > 0
      ? "released"
      : "baseline_pending";

  return {
    ...toPublicProfile(player, attributeRows.rows),
    lifecycleState,
    baselineApproved: approvedCount > 0,
    approvedSubmissions: approvedCount,
    club: membership ? { id: membership.id, name: membership.name } : null,
  };
}

// Recomputes players.overall / tier from the current player_attributes rows.
// Called from inside a transaction (pass its client) whenever a review credits
// XP — the same "never store what can be derived" rule the assessment follows.
export async function recomputeRating(client, playerId) {
  const playerResult = await client.query("SELECT position FROM players WHERE id = $1", [playerId]);
  const player = playerResult.rows[0];
  if (!player) {
    throw new AppError("Player not found.", 404, "PLAYER_NOT_FOUND");
  }

  const attributeRows = await client.query(
    `SELECT attributes.code, player_attributes.value
     FROM player_attributes
     JOIN attributes ON attributes.id = player_attributes.attribute_id
     WHERE player_attributes.player_id = $1`,
    [playerId],
  );
  const attrMap = {};
  for (const row of attributeRows.rows) {
    attrMap[row.code] = row.value;
  }

  const overall = computeOverall(player.position, attrMap);
  const tier = tierFor(overall);
  await client.query("UPDATE players SET overall = $1, tier = $2 WHERE id = $3", [
    overall,
    tier,
    playerId,
  ]);
  return { overall, tier };
}

// A club head coach (or admin) changes a rostered player's REGISTERED position
// — the one that drives their attribute set and dashboard, not the squad-slot
// label on the membership. Attacker <-> Defender keeps the same six outfield
// attributes; switching to/from Goalkeeper swaps the whole set, so those
// attributes are reset to a neutral baseline and the rating is recomputed.
const NEUTRAL_ATTR = 50;

async function assertCanManagePlayer(client, playerId, actingUser) {
  if (actingUser.role === "admin") return;
  if (actingUser.coachId == null) {
    throw new AppError("Only a club head coach can change a player's position.", 403, "FORBIDDEN");
  }
  const r = await client.query(
    `SELECT 1 FROM club_memberships m
     JOIN clubs cl ON cl.id = m.club_id
     WHERE m.player_id = $1 AND m.active AND cl.head_coach_id = $2 LIMIT 1`,
    [playerId, actingUser.coachId],
  );
  if (!r.rows[0]) {
    throw new AppError("This player is not on your roster.", 403, "NOT_YOUR_PLAYER");
  }
}

export async function setRegisteredPosition(playerId, position, actingUser) {
  if (!POSITIONS.includes(position)) {
    throw new AppError(`Position must be one of: ${POSITIONS.join(", ")}.`, 400, "VALIDATION_ERROR");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query(
      "SELECT id, position, user_id FROM players WHERE id = $1 FOR UPDATE",
      [playerId],
    );
    const player = cur.rows[0];
    if (!player) {
      throw new AppError("Player not found.", 404, "PLAYER_NOT_FOUND");
    }
    await assertCanManagePlayer(client, playerId, actingUser);

    if (player.position !== position) {
      const oldKeys = keysFor(player.position);
      const newKeys = keysFor(position);
      const sameSet =
        oldKeys.length === newKeys.length && oldKeys.every((k, i) => k === newKeys[i]);

      await client.query("UPDATE players SET position = $1 WHERE id = $2", [position, playerId]);

      if (!sameSet) {
        await client.query("DELETE FROM player_attributes WHERE player_id = $1", [playerId]);
        for (const key of newKeys) {
          await client.query(
            `INSERT INTO player_attributes (player_id, attribute_id, value)
             SELECT $1, id, $3 FROM attributes WHERE code = $2`,
            [playerId, key, NEUTRAL_ATTR],
          );
        }
      }
      await recomputeRating(client, playerId);
    }

    await client.query("COMMIT");
    return getProfileByUserId(player.user_id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
