import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { isPlatformEvaluator } from "../utils/roles.js";
import { keysFor, clampAttr } from "../utils/playerRating.js";
import { recomputeRating, getProfileByUserId } from "./players.service.js";
import { toPublicSession } from "./sessions.service.js";

// The review / approval loop. A Platform Evaluator (or admin) clears a new
// player's BASELINE submission; a club coach clears their own squad's
// submissions (club-coach queue scoping is filled in Phase 4). Approving a
// submission credits its aggregated drill boosts to the player's attributes
// (or applies the evaluator's verified values) and recomputes overall/tier —
// the loop that was completely missing until now.

function isReviewer(user) {
  return user.role === "admin" || isPlatformEvaluator(user);
}

async function playerHasApprovedSubmission(client, playerId) {
  const result = await client.query(
    "SELECT 1 FROM drill_submissions WHERE player_id = $1 AND review_status = 'approved' LIMIT 1",
    [playerId],
  );
  return result.rows.length > 0;
}

async function playerInCoachRoster(client, playerId, coachId) {
  const result = await client.query(
    `SELECT 1 FROM club_memberships m
     JOIN clubs cl ON cl.id = m.club_id
     WHERE m.player_id = $1 AND m.active AND cl.head_coach_id = $2 LIMIT 1`,
    [playerId, coachId],
  );
  return result.rows.length > 0;
}

// Queue of submissions this reviewer can action. Platform Evaluators + admins
// see the baseline queue (new players' first pass); a club coach sees
// submissions routed to them (broadened to their whole active roster in
// Phase 4).
export async function getReviewQueue(reviewer) {
  let where;
  let params = [];
  if (isReviewer(reviewer)) {
    where = `s.status = 'submitted'
       AND s.review_status = 'pending'
       AND s.reviewer_coach_id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM drill_submissions a
         WHERE a.player_id = s.player_id AND a.review_status = 'approved'
       )`;
  } else if (reviewer.coachId != null) {
    where = `s.status = 'submitted' AND s.review_status = 'pending'
       AND (
         s.reviewer_coach_id = $1
         OR s.player_id IN (
           SELECT m.player_id FROM club_memberships m
           JOIN clubs cl ON cl.id = m.club_id
           WHERE cl.head_coach_id = $1 AND m.active
         )
       )`;
    params = [reviewer.coachId];
  } else {
    return { queue: [] };
  }

  const subResult = await pool.query(
    `SELECT
       s.id, s.video_url, s.notes, s.review_status, s.submitted_at, s.total_time_minutes,
       s.player_id, p.position, p.overall, p.tier, p.height_cm, p.weight_kg,
       u.name AS player_name
     FROM drill_submissions s
     JOIN players p ON p.id = s.player_id
     JOIN users u ON u.id = p.user_id
     WHERE ${where}
     ORDER BY s.submitted_at ASC`,
    params,
  );

  const rows = subResult.rows;
  if (rows.length === 0) return { queue: [] };

  const submissionIds = rows.map((r) => r.id);
  const playerIds = [...new Set(rows.map((r) => r.player_id))];

  const drillResult = await pool.query(
    `SELECT drill_submission_id, name, unit_kind, sets, reps, boosts
     FROM drill_submission_drills
     WHERE drill_submission_id = ANY($1::int[])
     ORDER BY position`,
    [submissionIds],
  );
  const drillsBySubmission = new Map();
  for (const row of drillResult.rows) {
    if (!drillsBySubmission.has(row.drill_submission_id)) {
      drillsBySubmission.set(row.drill_submission_id, []);
    }
    drillsBySubmission.get(row.drill_submission_id).push({
      name: row.name,
      unitKind: row.unit_kind,
      sets: row.sets,
      reps: row.reps,
      boosts: row.boosts,
    });
  }

  const attrResult = await pool.query(
    `SELECT pa.player_id, a.code, pa.value
     FROM player_attributes pa
     JOIN attributes a ON a.id = pa.attribute_id
     WHERE pa.player_id = ANY($1::int[])`,
    [playerIds],
  );
  const attrsByPlayer = new Map();
  for (const row of attrResult.rows) {
    if (!attrsByPlayer.has(row.player_id)) attrsByPlayer.set(row.player_id, {});
    attrsByPlayer.get(row.player_id)[row.code] = row.value;
  }

  const queue = rows.map((r) => {
    const drills = drillsBySubmission.get(r.id) || [];
    const projectedRewards = {};
    for (const d of drills) {
      for (const [code, val] of Object.entries(d.boosts || {})) {
        projectedRewards[code] = (projectedRewards[code] || 0) + val;
      }
    }
    return {
      id: r.id,
      submittedAt: r.submitted_at,
      videoUrl: r.video_url,
      notes: r.notes,
      reviewStatus: r.review_status,
      totalTime: r.total_time_minutes,
      player: {
        id: r.player_id,
        name: r.player_name,
        position: r.position,
        overall: r.overall,
        tier: r.tier,
        heightCm: r.height_cm,
        weightKg: r.weight_kg,
        attributes: attrsByPlayer.get(r.player_id) || {},
      },
      drills,
      projectedRewards,
    };
  });

  return { queue };
}

// How many submissions this reviewer currently has waiting — the same
// filter getReviewQueue uses, counted rather than materialised.
async function countPending(reviewer) {
  if (isReviewer(reviewer)) {
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM drill_submissions s
       WHERE s.status = 'submitted' AND s.review_status = 'pending'
         AND s.reviewer_coach_id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM drill_submissions a
           WHERE a.player_id = s.player_id AND a.review_status = 'approved'
         )`,
    );
    return r.rows[0].n;
  }
  if (reviewer.coachId != null) {
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM drill_submissions s
       WHERE s.status = 'submitted' AND s.review_status = 'pending'
         AND (
           s.reviewer_coach_id = $1
           OR s.player_id IN (
             SELECT m.player_id FROM club_memberships m
             JOIN clubs cl ON cl.id = m.club_id
             WHERE cl.head_coach_id = $1 AND m.active
           )
         )`,
      [reviewer.coachId],
    );
    return r.rows[0].n;
  }
  return 0;
}

// Lifetime review totals for the signed-in reviewer, for the stat cards on
// the Evaluator Console and the Coach Review Queue. `reviewed_by` is stamped
// on every approve/reject (see reviewSubmission).
export async function getReviewStats(reviewer) {
  const [pending, totals, xp] = await Promise.all([
    countPending(reviewer),
    pool.query(
      `SELECT
         count(*) FILTER (WHERE review_status = 'approved')::int AS approved,
         count(*) FILTER (WHERE review_status = 'rejected')::int AS rejected,
         count(DISTINCT player_id) FILTER (WHERE review_status = 'approved')::int AS released
       FROM drill_submissions
       WHERE reviewed_by = $1`,
      [reviewer.id],
    ),
    pool.query(
      `SELECT COALESCE(SUM(v.value::int), 0)::int AS xp
       FROM drill_submissions ds
       JOIN drill_submission_drills dsd ON dsd.drill_submission_id = ds.id
       CROSS JOIN LATERAL jsonb_each_text(dsd.boosts) AS v(key, value)
       WHERE ds.reviewed_by = $1 AND ds.review_status = 'approved'`,
      [reviewer.id],
    ),
  ]);

  const t = totals.rows[0];
  return {
    pending,
    approved: t.approved,
    rejected: t.rejected,
    released: t.released,
    xpCredited: xp.rows[0].xp,
  };
}

export async function reviewSubmission({ submissionId, reviewer, verdict, feedback, verifiedAttributes }) {
  if (verdict !== "approved" && verdict !== "rejected") {
    throw new AppError('verdict must be "approved" or "rejected".', 400, "VALIDATION_ERROR");
  }

  const evaluatorOrAdmin = isReviewer(reviewer);
  const hasVerified =
    verifiedAttributes &&
    typeof verifiedAttributes === "object" &&
    Object.keys(verifiedAttributes).length > 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const subResult = await client.query("SELECT * FROM drill_submissions WHERE id = $1 FOR UPDATE", [
      submissionId,
    ]);
    const submission = subResult.rows[0];
    if (!submission) {
      throw new AppError("Submission not found.", 404, "SUBMISSION_NOT_FOUND");
    }
    if (submission.status !== "submitted") {
      throw new AppError("This submission hasn't been submitted for review.", 409, "SUBMISSION_NOT_SUBMITTED");
    }
    if (submission.review_status !== "pending") {
      throw new AppError("This submission has already been reviewed.", 409, "ALREADY_REVIEWED");
    }

    // Authorization.
    //  - admin: may action anything.
    //  - Platform Evaluator: only a baseline submission (no prior approved,
    //    not routed to a specific club coach).
    //  - club coach: only submissions routed to them (reviewer_coach_id).
    if (reviewer.role !== "admin") {
      if (isPlatformEvaluator(reviewer)) {
        const isBaseline =
          submission.reviewer_coach_id == null &&
          !(await playerHasApprovedSubmission(client, submission.player_id));
        if (!isBaseline) {
          throw new AppError("A club coach reviews this player's submissions.", 403, "NOT_YOUR_REVIEW");
        }
      } else if (
        reviewer.coachId != null &&
        (submission.reviewer_coach_id === reviewer.coachId ||
          (await playerInCoachRoster(client, submission.player_id, reviewer.coachId)))
      ) {
        // routed to this club coach, or the player is on their roster — allowed
      } else {
        throw new AppError("This submission isn't in your review queue.", 403, "NOT_YOUR_REVIEW");
      }
    }

    if (verdict === "rejected") {
      const updated = await client.query(
        `UPDATE drill_submissions
         SET review_status = 'rejected', review_feedback = $1, reviewed_at = now(), reviewed_by = $2
         WHERE id = $3 RETURNING *`,
        [feedback || null, reviewer.id, submissionId],
      );
      const publicSubmission = await toPublicSession(client, updated.rows[0]);
      await client.query("COMMIT");
      return { submission: publicSubmission, player: null };
    }

    // --- approved ---
    const playerResult = await client.query("SELECT id, position, user_id FROM players WHERE id = $1", [
      submission.player_id,
    ]);
    const player = playerResult.rows[0];
    if (!player) {
      throw new AppError("Player not found.", 404, "PLAYER_NOT_FOUND");
    }
    const keys = keysFor(player.position);

    if (hasVerified) {
      // Evaluator's verified card is the final baseline — set absolutely, do
      // not additionally stack the drill boosts on the same review.
      for (const [key, value] of Object.entries(verifiedAttributes)) {
        if (!keys.includes(key)) {
          throw new AppError(
            `Attribute "${key}" is not valid for a ${player.position}.`,
            400,
            "VALIDATION_ERROR",
          );
        }
        if (!Number.isInteger(value) || value < 0 || value > 100) {
          throw new AppError(
            `Attribute "${key}" must be a whole number between 0 and 100.`,
            400,
            "VALIDATION_ERROR",
          );
        }
      }
      for (const [key, value] of Object.entries(verifiedAttributes)) {
        await client.query(
          `UPDATE player_attributes SET value = $1
           WHERE player_id = $2
             AND attribute_id = (SELECT id FROM attributes WHERE code = $3)`,
          [clampAttr(value), player.id, key],
        );
      }
    } else {
      // Credit the submission's aggregated drill boosts.
      const drillRows = await client.query(
        "SELECT boosts FROM drill_submission_drills WHERE drill_submission_id = $1",
        [submissionId],
      );
      const agg = {};
      for (const row of drillRows.rows) {
        for (const [code, val] of Object.entries(row.boosts || {})) {
          agg[code] = (agg[code] || 0) + val;
        }
      }
      for (const [code, boost] of Object.entries(agg)) {
        // Skip codes outside this player's position set (rowCount 0).
        await client.query(
          `UPDATE player_attributes
           SET value = LEAST(100, GREATEST(0, value + $1))
           WHERE player_id = $2
             AND attribute_id = (SELECT id FROM attributes WHERE code = $3)`,
          [boost, player.id, code],
        );
      }
    }

    await recomputeRating(client, player.id);

    const updated = await client.query(
      `UPDATE drill_submissions
       SET review_status = 'approved', review_feedback = $1, reviewed_at = now(), reviewed_by = $2
       WHERE id = $3 RETURNING *`,
      [feedback || null, reviewer.id, submissionId],
    );
    const publicSubmission = await toPublicSession(client, updated.rows[0]);

    await client.query("COMMIT");

    const profile = await getProfileByUserId(player.user_id);
    return { submission: publicSubmission, player: profile };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
