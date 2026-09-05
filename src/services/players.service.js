import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

const POSITIONS = ["Attacker", "Defender", "Goalkeeper"];
const FEET = ["Left", "Right", "Both"];

// Keys match what the assessment wizard sends (see
// frontend/src/hooks/usePlayerAssessment.js buildPayload) and the `code`
// column of the attributes catalog table.
const OUTFIELD_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"];
const GK_KEYS = ["diving", "handling", "kicking", "reflexes", "speed", "positioning"];

function keysFor(position) {
  return position === "Goalkeeper" ? GK_KEYS : OUTFIELD_KEYS;
}

// Same thresholds as the frontend's tierFor() — kept here too because the
// server recomputes overall/tier itself rather than trusting client values.
function tierFor(overall) {
  if (overall >= 75) return "Gold";
  if (overall >= 65) return "Silver";
  return "Bronze";
}

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
  const overall = Math.round(keys.reduce((sum, key) => sum + attributes[key], 0) / keys.length);
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
    throw new AppError("No player profile yet — complete the assessment first.", 404, "PLAYER_NOT_FOUND");
  }

  const attributeRows = await pool.query(
    `SELECT attributes.code, player_attributes.value
     FROM player_attributes
     JOIN attributes ON attributes.id = player_attributes.attribute_id
     WHERE player_attributes.player_id = $1`,
    [player.id],
  );

  return toPublicProfile(player, attributeRows.rows);
}
