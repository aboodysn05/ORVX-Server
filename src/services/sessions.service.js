import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { estimateMinutes } from "../utils/drillTiming.js";

async function getPlayerId(userId) {
  const result = await pool.query("SELECT id FROM players WHERE user_id = $1", [userId]);
  if (result.rows.length === 0) {
    throw new AppError("No player profile yet — complete the assessment first.", 404, "PLAYER_NOT_FOUND");
  }
  return result.rows[0].id;
}

function drillMinutes(drillRow, sets, reps) {
  return estimateMinutes(drillRow.unit_kind, sets, reps, drillRow.seconds_per_set);
}

function validateDrillSelections(drills) {
  if (!Array.isArray(drills) || drills.length === 0) {
    throw new AppError("A session needs at least one drill.", 400, "VALIDATION_ERROR");
  }
  for (const entry of drills) {
    if (!Number.isInteger(entry.drillId)) {
      throw new AppError("Each drill needs a valid drillId.", 400, "VALIDATION_ERROR");
    }
    if (!Number.isInteger(entry.sets) || entry.sets < 1 || entry.sets > 20) {
      throw new AppError("sets must be a whole number between 1 and 20.", 400, "VALIDATION_ERROR");
    }
    if (!Number.isInteger(entry.reps) || entry.reps < 1 || entry.reps > 300) {
      throw new AppError("reps must be a whole number between 1 and 300.", 400, "VALIDATION_ERROR");
    }
  }
}

async function toPublicSession(client, sessionRow) {
  const drillRows = await client.query(
    "SELECT * FROM session_drills WHERE session_id = $1 ORDER BY position",
    [sessionRow.id],
  );

  const rewards = {};
  for (const row of drillRows.rows) {
    for (const [code, value] of Object.entries(row.boosts)) {
      rewards[code] = (rewards[code] || 0) + value;
    }
  }

  return {
    id: sessionRow.id,
    name: sessionRow.name,
    focus: sessionRow.focus,
    status: sessionRow.status,
    totalTime: sessionRow.total_time_minutes,
    rewards,
    videoUrl: sessionRow.video_url,
    notes: sessionRow.notes,
    reviewerName: sessionRow.reviewer_name,
    reviewStatus: sessionRow.review_status,
    startedAt: sessionRow.started_at,
    completedAt: sessionRow.completed_at,
    submittedAt: sessionRow.submitted_at,
    drills: drillRows.rows.map((row) => ({
      id: row.id,
      drillId: row.drill_id,
      name: row.name,
      unitKind: row.unit_kind,
      sets: row.sets,
      reps: row.reps,
      boosts: row.boosts,
      progress: row.progress,
    })),
  };
}

export async function createSession(userId, { name, focus, drills }) {
  if (!name || !name.trim()) {
    throw new AppError("Session name is required.", 400, "VALIDATION_ERROR");
  }
  validateDrillSelections(drills);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const playerId = await getPlayerId(userId);

    const inFlight = await client.query(
      "SELECT id FROM training_sessions WHERE player_id = $1 AND status IN ('active', 'completed')",
      [playerId],
    );
    if (inFlight.rows.length > 0) {
      throw new AppError(
        "You already have a session in progress — finish or discard it first.",
        409,
        "SESSION_IN_PROGRESS",
      );
    }

    const drillIds = drills.map((entry) => entry.drillId);
    const catalogResult = await client.query(
      `SELECT
         drills.id, drills.name, drills.unit_kind, drills.seconds_per_set,
         COALESCE(
           jsonb_object_agg(attributes.code, drill_attribute_boosts.boost_value)
             FILTER (WHERE attributes.code IS NOT NULL),
           '{}'
         ) AS boosts
       FROM drills
       LEFT JOIN drill_attribute_boosts ON drill_attribute_boosts.drill_id = drills.id
       LEFT JOIN attributes ON attributes.id = drill_attribute_boosts.attribute_id
       WHERE drills.id = ANY($1::int[])
       GROUP BY drills.id`,
      [drillIds],
    );
    const catalogById = new Map(catalogResult.rows.map((row) => [row.id, row]));
    for (const drillId of drillIds) {
      if (!catalogById.has(drillId)) {
        throw new AppError(`Drill ${drillId} does not exist.`, 400, "VALIDATION_ERROR");
      }
    }

    const totalTimeMinutes = drills.reduce(
      (sum, entry) => sum + drillMinutes(catalogById.get(entry.drillId), entry.sets, entry.reps),
      0,
    );

    const sessionResult = await client.query(
      `INSERT INTO training_sessions (player_id, name, focus, total_time_minutes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [playerId, name.trim(), focus || null, totalTimeMinutes],
    );
    const session = sessionResult.rows[0];

    let position = 1;
    for (const entry of drills) {
      const catalogDrill = catalogById.get(entry.drillId);
      await client.query(
        `INSERT INTO session_drills (session_id, drill_id, position, name, unit_kind, sets, reps, boosts, progress)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          session.id,
          catalogDrill.id,
          position++,
          catalogDrill.name,
          catalogDrill.unit_kind,
          entry.sets,
          entry.reps,
          JSON.stringify(catalogDrill.boosts),
          JSON.stringify(Array(entry.sets).fill(false)),
        ],
      );
    }

    const publicSession = await toPublicSession(client, session);
    await client.query("COMMIT");
    return publicSession;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getInFlightSessionRow(playerId) {
  const result = await pool.query(
    "SELECT * FROM training_sessions WHERE player_id = $1 AND status IN ('active', 'completed')",
    [playerId],
  );
  return result.rows[0] || null;
}

export async function getActiveSession(userId) {
  const playerId = await getPlayerId(userId);
  const session = await getInFlightSessionRow(playerId);
  if (!session) {
    throw new AppError("No session in progress.", 404, "SESSION_NOT_FOUND");
  }
  return toPublicSession(pool, session);
}

// Ownership check shared by every mutation below — a session's id alone isn't
// enough, it must also belong to the calling player.
async function getOwnedSession(client, userId, sessionId) {
  const playerId = await getPlayerId(userId);
  const result = await client.query(
    "SELECT * FROM training_sessions WHERE id = $1 AND player_id = $2",
    [sessionId, playerId],
  );
  if (result.rows.length === 0) {
    throw new AppError("Session not found.", 404, "SESSION_NOT_FOUND");
  }
  return result.rows[0];
}

export async function saveProgress(userId, sessionId, progress) {
  if (!Array.isArray(progress)) {
    throw new AppError("progress must be an array.", 400, "VALIDATION_ERROR");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const session = await getOwnedSession(client, userId, sessionId);
    if (session.status !== "active") {
      throw new AppError("This session is no longer active.", 409, "SESSION_NOT_ACTIVE");
    }

    const drillRows = await client.query(
      "SELECT id FROM session_drills WHERE session_id = $1 ORDER BY position",
      [sessionId],
    );
    if (progress.length !== drillRows.rows.length) {
      throw new AppError("progress must have one entry per drill in the session.", 400, "VALIDATION_ERROR");
    }

    for (let i = 0; i < drillRows.rows.length; i++) {
      await client.query("UPDATE session_drills SET progress = $1 WHERE id = $2", [
        JSON.stringify(progress[i].map(Boolean)),
        drillRows.rows[i].id,
      ]);
    }

    const publicSession = await toPublicSession(client, session);
    await client.query("COMMIT");
    return publicSession;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function completeSession(userId, sessionId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const session = await getOwnedSession(client, userId, sessionId);
    if (session.status !== "active") {
      throw new AppError("This session is no longer active.", 409, "SESSION_NOT_ACTIVE");
    }

    const drillRows = await client.query("SELECT progress FROM session_drills WHERE session_id = $1", [
      sessionId,
    ]);
    const allDone = drillRows.rows.every((row) => row.progress.length > 0 && row.progress.every(Boolean));
    if (!allDone) {
      throw new AppError("Every set must be ticked before finishing the session.", 409, "SESSION_INCOMPLETE");
    }

    const result = await client.query(
      "UPDATE training_sessions SET status = 'completed', completed_at = now() WHERE id = $1 RETURNING *",
      [sessionId],
    );
    const publicSession = await toPublicSession(client, result.rows[0]);
    await client.query("COMMIT");
    return publicSession;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function discardSession(userId, sessionId) {
  const playerId = await getPlayerId(userId);
  const result = await pool.query(
    "DELETE FROM training_sessions WHERE id = $1 AND player_id = $2 AND status != 'submitted' RETURNING id",
    [sessionId, playerId],
  );
  if (result.rows.length === 0) {
    throw new AppError("Session not found, or it's already submitted.", 404, "SESSION_NOT_FOUND");
  }
}

// Video upload/storage isn't wired up yet — this accepts a URL for the clip
// (wherever it ends up being hosted) rather than a file. Reviewer is a plain
// name for now, same simplification as the frontend's hardcoded coach list.
export async function submitSession(userId, sessionId, { videoUrl, notes, reviewerName }) {
  if (!videoUrl || !videoUrl.trim()) {
    throw new AppError("A video proof URL is required to submit.", 400, "VALIDATION_ERROR");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const session = await getOwnedSession(client, userId, sessionId);
    if (session.status !== "completed") {
      throw new AppError("Finish the workout before submitting proof.", 409, "SESSION_NOT_COMPLETED");
    }

    const result = await client.query(
      `UPDATE training_sessions
       SET status = 'submitted', submitted_at = now(), video_url = $1, notes = $2, reviewer_name = $3
       WHERE id = $4
       RETURNING *`,
      [videoUrl.trim(), notes || null, reviewerName || null, sessionId],
    );
    const publicSession = await toPublicSession(client, result.rows[0]);
    await client.query("COMMIT");
    return publicSession;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listSessions(userId, status) {
  const playerId = await getPlayerId(userId);
  const params = [playerId];
  let query = "SELECT * FROM training_sessions WHERE player_id = $1";
  if (status) {
    params.push(status);
    query += " AND status = $2";
  }
  query += " ORDER BY started_at DESC";

  const result = await pool.query(query, params);
  const sessions = [];
  for (const row of result.rows) {
    sessions.push(await toPublicSession(pool, row));
  }
  return sessions;
}
