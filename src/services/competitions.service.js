import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

async function getCompetition(competitionId) {
  const result = await pool.query("SELECT * FROM competitions WHERE id = $1", [competitionId]);
  if (result.rows.length === 0) {
    throw new AppError("Competition not found.", 404, "COMPETITION_NOT_FOUND");
  }
  return result.rows[0];
}

export async function listCompetitions() {
  const result = await pool.query("SELECT id, name, type, season FROM competitions ORDER BY id");
  return result.rows;
}

const COMPETITION_TYPES = ["league", "knockout"];

export async function createCompetition({ name, type, season }) {
  if (!name || !name.trim()) {
    throw new AppError("Competition name is required.", 400, "VALIDATION_ERROR");
  }
  if (!COMPETITION_TYPES.includes(type)) {
    throw new AppError(`type must be one of: ${COMPETITION_TYPES.join(", ")}.`, 400, "VALIDATION_ERROR");
  }
  if (!season || !season.trim()) {
    throw new AppError("season is required.", 400, "VALIDATION_ERROR");
  }
  const result = await pool.query(
    `INSERT INTO competitions (name, type, season) VALUES ($1, $2, $3)
     RETURNING id, name, type, season`,
    [name.trim(), type, season.trim()],
  );
  return result.rows[0];
}

// Only name/season are editable. `type` is fixed once created — changing it
// would invalidate every recorded match's standings/bracket semantics.
export async function updateCompetition(competitionId, patch) {
  const competition = await getCompetition(competitionId);

  if (patch.type !== undefined && patch.type !== competition.type) {
    throw new AppError(
      "A competition's type can't be changed after it's created.",
      400,
      "COMPETITION_TYPE_LOCKED",
    );
  }

  const name = patch.name !== undefined ? patch.name : competition.name;
  const season = patch.season !== undefined ? patch.season : competition.season;
  if (!name || !name.trim()) {
    throw new AppError("Competition name is required.", 400, "VALIDATION_ERROR");
  }
  if (!season || !season.trim()) {
    throw new AppError("season is required.", 400, "VALIDATION_ERROR");
  }

  const result = await pool.query(
    `UPDATE competitions SET name = $1, season = $2 WHERE id = $3
     RETURNING id, name, type, season`,
    [name.trim(), season.trim(), competitionId],
  );
  return result.rows[0];
}

// Removes the competition and, by FK cascade, all of its matches and their
// goals. Reports how many matches went with it so the UI can warn/confirm.
export async function deleteCompetition(competitionId) {
  const countResult = await pool.query(
    "SELECT count(*)::int AS n FROM matches WHERE competition_id = $1",
    [competitionId],
  );
  const result = await pool.query(
    "DELETE FROM competitions WHERE id = $1 RETURNING id",
    [competitionId],
  );
  if (result.rows.length === 0) {
    throw new AppError("Competition not found.", 404, "COMPETITION_NOT_FOUND");
  }
  return { id: competitionId, deletedMatches: countResult.rows[0].n };
}

async function loadMatchGoals(client, matchId) {
  const result = await client.query(
    "SELECT club_id, scorer_name, minute FROM match_goals WHERE match_id = $1 ORDER BY minute NULLS LAST, id",
    [matchId],
  );
  return result.rows.map((r) => ({ clubId: r.club_id, scorerName: r.scorer_name, minute: r.minute }));
}

async function toPublicMatch(client, matchRow) {
  const goals = await loadMatchGoals(client, matchRow.id);
  return {
    id: matchRow.id,
    competitionId: matchRow.competition_id,
    round: matchRow.round_label,
    leg: matchRow.leg,
    homeClubId: matchRow.home_club_id,
    awayClubId: matchRow.away_club_id,
    homeScore: matchRow.home_score,
    awayScore: matchRow.away_score,
    status: matchRow.status,
    scheduledAt: matchRow.scheduled_at,
    goals,
  };
}

function validateGoals(goals, { homeClubId, awayClubId, homeScore, awayScore }) {
  if (goals == null) return;
  if (!Array.isArray(goals)) {
    throw new AppError("goals must be an array.", 400, "VALIDATION_ERROR");
  }
  let homeGoals = 0;
  let awayGoals = 0;
  for (const g of goals) {
    if (!g || (g.clubId !== homeClubId && g.clubId !== awayClubId)) {
      throw new AppError("Each goal's clubId must be the home or away club.", 400, "VALIDATION_ERROR");
    }
    if (typeof g.scorerName !== "string" || !g.scorerName.trim()) {
      throw new AppError("Each goal needs a scorerName.", 400, "VALIDATION_ERROR");
    }
    if (g.minute != null && (!Number.isInteger(g.minute) || g.minute < 1 || g.minute > 130)) {
      throw new AppError("A goal's minute must be a whole number between 1 and 130.", 400, "VALIDATION_ERROR");
    }
    if (g.clubId === homeClubId) homeGoals++;
    else awayGoals++;
  }
  if (homeGoals !== homeScore || awayGoals !== awayScore) {
    throw new AppError(
      "The number of goals for each club must match its score.",
      400,
      "GOAL_COUNT_MISMATCH",
    );
  }
}

async function writeGoals(client, matchId, goals) {
  await client.query("DELETE FROM match_goals WHERE match_id = $1", [matchId]);
  for (const g of goals || []) {
    await client.query(
      "INSERT INTO match_goals (match_id, club_id, scorer_name, minute) VALUES ($1, $2, $3, $4)",
      [matchId, g.clubId, g.scorerName.trim(), g.minute ?? null],
    );
  }
}

export async function createMatch(competitionId, payload) {
  const competition = await getCompetition(competitionId);
  const {
    homeClubId,
    awayClubId,
    roundLabel = null,
    leg = null,
    homeScore,
    awayScore,
    playedOn,
    goals = null,
  } = payload;

  if (!Number.isInteger(homeClubId) || !Number.isInteger(awayClubId)) {
    throw new AppError("homeClubId and awayClubId are required.", 400, "VALIDATION_ERROR");
  }
  if (homeClubId === awayClubId) {
    throw new AppError("A club cannot play itself.", 400, "SAME_CLUB");
  }
  if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) {
    throw new AppError("Scores must be whole numbers of 0 or more.", 400, "VALIDATION_ERROR");
  }
  if (competition.type === "knockout") {
    if (leg != null && leg !== 1 && leg !== 2) {
      throw new AppError("leg must be 1 or 2 for a knockout match.", 400, "VALIDATION_ERROR");
    }
  } else if (leg != null) {
    throw new AppError("leg only applies to knockout matches.", 400, "VALIDATION_ERROR");
  }
  const playedAt = playedOn ? new Date(playedOn) : new Date();
  if (Number.isNaN(playedAt.getTime())) {
    throw new AppError("playedOn must be a valid date.", 400, "VALIDATION_ERROR");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const clubCheck = await client.query("SELECT id FROM clubs WHERE id = ANY($1::int[])", [
      [homeClubId, awayClubId],
    ]);
    if (clubCheck.rows.length !== 2) {
      throw new AppError("One or both clubs do not exist.", 400, "CLUB_NOT_FOUND");
    }
    validateGoals(goals, { homeClubId, awayClubId, homeScore, awayScore });

    const inserted = await client.query(
      `INSERT INTO matches
         (competition_id, round_label, leg, home_club_id, away_club_id, home_score, away_score, status, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'played', $8)
       RETURNING *`,
      [competitionId, roundLabel, leg, homeClubId, awayClubId, homeScore, awayScore, playedAt.toISOString()],
    );
    const match = inserted.rows[0];
    await writeGoals(client, match.id, goals);
    const publicMatch = await toPublicMatch(client, match);
    await client.query("COMMIT");
    return publicMatch;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateMatch(matchId, patch) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM matches WHERE id = $1 FOR UPDATE", [matchId]);
    const match = existing.rows[0];
    if (!match) {
      throw new AppError("Match not found.", 404, "MATCH_NOT_FOUND");
    }

    const homeScore = patch.homeScore ?? match.home_score;
    const awayScore = patch.awayScore ?? match.away_score;
    if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) {
      throw new AppError("Scores must be whole numbers of 0 or more.", 400, "VALIDATION_ERROR");
    }
    const roundLabel = patch.roundLabel !== undefined ? patch.roundLabel : match.round_label;
    let leg = patch.leg !== undefined ? patch.leg : match.leg;
    if (leg != null && leg !== 1 && leg !== 2) {
      throw new AppError("leg must be 1 or 2.", 400, "VALIDATION_ERROR");
    }
    let scheduledAt = match.scheduled_at;
    if (patch.playedOn !== undefined) {
      const d = new Date(patch.playedOn);
      if (Number.isNaN(d.getTime())) {
        throw new AppError("playedOn must be a valid date.", 400, "VALIDATION_ERROR");
      }
      scheduledAt = d.toISOString();
    }

    await client.query(
      `UPDATE matches
       SET home_score = $1, away_score = $2, round_label = $3, leg = $4, scheduled_at = $5, status = 'played'
       WHERE id = $6`,
      [homeScore, awayScore, roundLabel, leg, scheduledAt, matchId],
    );

    if (patch.goals !== undefined) {
      validateGoals(patch.goals, {
        homeClubId: match.home_club_id,
        awayClubId: match.away_club_id,
        homeScore,
        awayScore,
      });
      await writeGoals(client, matchId, patch.goals);
    }

    const refreshed = await client.query("SELECT * FROM matches WHERE id = $1", [matchId]);
    const publicMatch = await toPublicMatch(client, refreshed.rows[0]);
    await client.query("COMMIT");
    return publicMatch;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteMatch(matchId) {
  const result = await pool.query("DELETE FROM matches WHERE id = $1 RETURNING id", [matchId]);
  if (result.rows.length === 0) {
    throw new AppError("Match not found.", 404, "MATCH_NOT_FOUND");
  }
}

// Standings are never stored — always computed from played fixtures, the
// same principle as a player's "approved sessions" count never being a
// stored column (see players.service.js's docs elsewhere in this codebase).
export async function getStandings(competitionId) {
  const competition = await getCompetition(competitionId);
  if (competition.type !== "league") {
    throw new AppError("Standings only apply to league competitions.", 400, "NOT_A_LEAGUE");
  }

  const result = await pool.query(
    `
    WITH participations AS (
      SELECT f.scheduled_at, f.home_club_id AS club_id, f.home_score AS gf, f.away_score AS ga
      FROM matches f WHERE f.competition_id = $1 AND f.status = 'played'
      UNION ALL
      SELECT f.scheduled_at, f.away_club_id, f.away_score, f.home_score
      FROM matches f WHERE f.competition_id = $1 AND f.status = 'played'
    ),
    totals AS (
      SELECT
        club_id,
        count(*) AS played,
        sum((gf > ga)::int) AS won,
        sum((gf = ga)::int) AS drawn,
        sum((gf < ga)::int) AS lost,
        sum(gf) AS goals_for,
        sum(ga) AS goals_against,
        sum(gf) - sum(ga) AS goal_diff,
        sum(CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END) AS points
      FROM participations
      GROUP BY club_id
    ),
    recent AS (
      SELECT club_id, gf, ga, row_number() OVER (PARTITION BY club_id ORDER BY scheduled_at DESC) AS rn
      FROM participations
    )
    SELECT
      clubs.id, clubs.name, clubs.crest_code, totals.*,
      (
        SELECT array_agg(CASE WHEN gf > ga THEN 'W' WHEN gf = ga THEN 'D' ELSE 'L' END ORDER BY rn DESC)
        FROM recent WHERE recent.club_id = clubs.id AND rn <= 5
      ) AS form
    FROM clubs
    JOIN totals ON totals.club_id = clubs.id
    ORDER BY totals.points DESC, totals.goal_diff DESC, totals.goals_for DESC
    `,
    [competitionId],
  );

  return result.rows.map((row, index) => ({
    position: index + 1,
    clubId: row.id,
    club: row.name,
    crestCode: row.crest_code,
    played: Number(row.played),
    won: Number(row.won),
    drawn: Number(row.drawn),
    lost: Number(row.lost),
    goalsFor: Number(row.goals_for),
    goalsAgainst: Number(row.goals_against),
    goalDiff: Number(row.goal_diff),
    points: Number(row.points),
    form: row.form || [],
  }));
}

export async function getFixtures(competitionId) {
  await getCompetition(competitionId);
  const result = await pool.query(
    `
    SELECT f.id, f.round_label, f.leg, f.home_club_id, f.away_club_id,
      f.home_score, f.away_score, f.status, f.scheduled_at,
      hc.name AS home_name, ac.name AS away_name
    FROM matches f
    JOIN clubs hc ON hc.id = f.home_club_id
    JOIN clubs ac ON ac.id = f.away_club_id
    WHERE f.competition_id = $1
    ORDER BY f.scheduled_at
    `,
    [competitionId],
  );

  const ids = result.rows.map((r) => r.id);
  const goalsByMatch = new Map();
  if (ids.length > 0) {
    const goalRows = await pool.query(
      `SELECT match_id, club_id, scorer_name, minute FROM match_goals
       WHERE match_id = ANY($1::int[]) ORDER BY minute NULLS LAST, id`,
      [ids],
    );
    for (const g of goalRows.rows) {
      if (!goalsByMatch.has(g.match_id)) goalsByMatch.set(g.match_id, []);
      goalsByMatch.get(g.match_id).push({ clubId: g.club_id, scorerName: g.scorer_name, minute: g.minute });
    }
  }

  return result.rows.map((row) => ({
    id: row.id,
    round: row.round_label,
    leg: row.leg,
    home: row.home_name,
    away: row.away_name,
    homeClubId: row.home_club_id,
    awayClubId: row.away_club_id,
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    scheduledAt: row.scheduled_at,
    goals: goalsByMatch.get(row.id) || [],
  }));
}

// Groups a knockout competition's leg-1/leg-2 fixtures into ties per round.
// Home/away identity for a tie is fixed by leg 1; leg 2 is the same two
// clubs at the other ground. Nothing here is stored — it's rebuilt from the
// raw fixture rows every time.
export async function getBracket(competitionId) {
  const competition = await getCompetition(competitionId);
  if (competition.type !== "knockout") {
    throw new AppError("A bracket only applies to knockout competitions.", 400, "NOT_A_KNOCKOUT");
  }

  const result = await pool.query(
    `
    SELECT f.round_label, f.leg, f.home_score, f.away_score, f.status, f.scheduled_at,
      hc.id AS home_id, hc.name AS home_name, ac.id AS away_id, ac.name AS away_name
    FROM matches f
    JOIN clubs hc ON hc.id = f.home_club_id
    JOIN clubs ac ON ac.id = f.away_club_id
    WHERE f.competition_id = $1
    ORDER BY f.round_label, f.scheduled_at
    `,
    [competitionId],
  );

  const roundOrder = [];
  const tiesByRound = new Map();

  for (const row of result.rows) {
    if (!tiesByRound.has(row.round_label)) {
      tiesByRound.set(row.round_label, new Map());
      roundOrder.push(row.round_label);
    }
    const pairKey = [row.home_id, row.away_id].sort((a, b) => a - b).join("-");
    const ties = tiesByRound.get(row.round_label);
    if (!ties.has(pairKey)) {
      ties.set(pairKey, {});
    }
    const tie = ties.get(pairKey);
    // Leg 1 fixes which club is "home" for the tie's display purposes.
    if (row.leg === 1) {
      tie.home = row.home_name;
      tie.away = row.away_name;
      tie.leg1 = row.status === "played" ? `${row.home_score}–${row.away_score}` : null;
      tie.leg1Goals = row.status === "played" ? { [row.home_id]: row.home_score, [row.away_id]: row.away_score } : null;
    } else {
      tie.leg2 = row.status === "played" ? `${row.home_score}–${row.away_score}` : null;
      tie.leg2Goals = row.status === "played" ? { [row.home_id]: row.home_score, [row.away_id]: row.away_score } : null;
      tie.leg2ScheduledAt = row.scheduled_at;
      tie.homeId = row.away_id; // leg 2's away side is leg 1's home side
      tie.awayId = row.home_id;
    }
    if (row.leg === 1) {
      tie.homeId = row.home_id;
      tie.awayId = row.away_id;
    }
  }

  const rounds = roundOrder.map((round) => ({
    round,
    ties: Array.from(tiesByRound.get(round).values()).map((tie) => {
      const decided = tie.leg1Goals && tie.leg2Goals;
      let agg = null;
      let through = null;
      if (decided) {
        const homeTotal = tie.leg1Goals[tie.homeId] + tie.leg2Goals[tie.homeId];
        const awayTotal = tie.leg1Goals[tie.awayId] + tie.leg2Goals[tie.awayId];
        agg = `${homeTotal}–${awayTotal}`;
        through = homeTotal === awayTotal ? null : homeTotal > awayTotal ? tie.home : tie.away;
      }
      return {
        home: tie.home,
        away: tie.away,
        leg1: tie.leg1 || null,
        leg2: tie.leg2 || null,
        agg,
        through,
        pending: !decided,
      };
    }),
  }));

  // Return the array; the controller wraps it as `{ rounds }` (the shape the
  // Leagues page already reads).
  return rounds;
}

// ---------------------------------------------------------------------------
// Fixture generation (C2). Instead of the admin hand-entering every scheduled
// match, seed a whole round-robin or a knockout bracket, then let the bracket
// advance itself as results come in.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86400000;

function roundNameForTeams(teams) {
  if (teams <= 2) return "Final";
  if (teams <= 4) return "Semi-Finals";
  if (teams <= 8) return "Quarter-Finals";
  return "Round of 16";
}

// getBracket() orders rounds by round_label alphabetically, not by
// progression, so pick the current round by this rank instead.
const ROUND_RANK = { "Round of 16": 1, "Quarter-Finals": 2, "Semi-Finals": 3, "Final": 4 };

async function validateClubIds(clubIds) {
  if (!Array.isArray(clubIds) || clubIds.length < 2) {
    throw new AppError("Provide at least two clubs.", 400, "VALIDATION_ERROR");
  }
  const ids = clubIds.map(Number);
  if (ids.some((n) => !Number.isInteger(n)) || new Set(ids).size !== ids.length) {
    throw new AppError("clubIds must be distinct club ids.", 400, "VALIDATION_ERROR");
  }
  const found = await pool.query("SELECT id FROM clubs WHERE id = ANY($1::int[])", [ids]);
  if (found.rows.length !== ids.length) {
    throw new AppError("One or more clubs do not exist.", 400, "CLUB_NOT_FOUND");
  }
  return ids;
}

// Circle method: fixed first slot, rotate the rest. Alternates home/away by
// round so no club is home (or away) every week.
function roundRobin(ids) {
  const arr = [...ids];
  if (arr.length % 2 === 1) arr.push(null); // bye marker
  const n = arr.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a != null && b != null) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()); // rotate, keeping arr[0] fixed
  }
  return rounds;
}

async function assertNoResults(client, competitionId) {
  const played = await client.query(
    "SELECT 1 FROM matches WHERE competition_id = $1 AND status = 'played' LIMIT 1",
    [competitionId],
  );
  if (played.rows.length > 0) {
    throw new AppError(
      "This competition already has recorded results — delete it to re-generate.",
      409,
      "HAS_RESULTS",
    );
  }
  await client.query(
    "DELETE FROM matches WHERE competition_id = $1 AND status = 'scheduled'",
    [competitionId],
  );
}

async function insertScheduled(client, competitionId, roundLabel, leg, homeId, awayId, when) {
  await client.query(
    `INSERT INTO matches
       (competition_id, round_label, leg, home_club_id, away_club_id, status, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)`,
    [competitionId, roundLabel, leg, homeId, awayId, when.toISOString()],
  );
}

export async function generateLeagueFixtures(
  competitionId,
  { clubIds, doubleRound = false, startDate, daysBetweenRounds = 7 } = {},
) {
  const competition = await getCompetition(competitionId);
  if (competition.type !== "league") {
    throw new AppError("Fixture generation for a table only applies to a league.", 400, "NOT_A_LEAGUE");
  }
  const ids = await validateClubIds(clubIds);
  const base = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(base.getTime())) {
    throw new AppError("startDate must be a valid date.", 400, "VALIDATION_ERROR");
  }
  const gap = Number(daysBetweenRounds) > 0 ? Number(daysBetweenRounds) : 7;

  let rounds = roundRobin(ids);
  if (doubleRound) {
    rounds = rounds.concat(rounds.map((pairs) => pairs.map(([h, a]) => [a, h])));
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertNoResults(client, competitionId);
    let created = 0;
    for (let r = 0; r < rounds.length; r++) {
      const when = new Date(base.getTime() + r * gap * MS_PER_DAY);
      for (const [homeId, awayId] of rounds[r]) {
        await insertScheduled(client, competitionId, `Matchday ${r + 1}`, null, homeId, awayId, when);
        created += 1;
      }
    }
    await client.query("COMMIT");
    return { created, matchdays: rounds.length };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function generateKnockoutBracket(
  competitionId,
  { clubIds, startDate, daysBetweenLegs = 7 } = {},
) {
  const competition = await getCompetition(competitionId);
  if (competition.type !== "knockout") {
    throw new AppError("Bracket generation only applies to a knockout.", 400, "NOT_A_KNOCKOUT");
  }
  const ids = await validateClubIds(clubIds);
  if (![2, 4, 8, 16].includes(ids.length)) {
    throw new AppError("A bracket needs 2, 4, 8 or 16 clubs.", 400, "BAD_BRACKET_SIZE");
  }
  const base = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(base.getTime())) {
    throw new AppError("startDate must be a valid date.", 400, "VALIDATION_ERROR");
  }
  const legGap = Number(daysBetweenLegs) > 0 ? Number(daysBetweenLegs) : 7;
  const roundLabel = roundNameForTeams(ids.length);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertNoResults(client, competitionId);
    let created = 0;
    for (let i = 0; i < ids.length / 2; i++) {
      const a = ids[i];
      const b = ids[ids.length - 1 - i];
      await insertScheduled(client, competitionId, roundLabel, 1, a, b, base);
      await insertScheduled(
        client,
        competitionId,
        roundLabel,
        2,
        b,
        a,
        new Date(base.getTime() + legGap * MS_PER_DAY),
      );
      created += 2;
    }
    await client.query("COMMIT");
    return { round: roundLabel, ties: ids.length / 2, created };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Creates the next knockout round from the winners of the most advanced round,
// once every tie in it has a decided aggregate.
export async function advanceKnockout(
  competitionId,
  { startDate, daysBetweenLegs = 7 } = {},
) {
  const competition = await getCompetition(competitionId);
  if (competition.type !== "knockout") {
    throw new AppError("Only a knockout can be advanced.", 400, "NOT_A_KNOCKOUT");
  }

  const rounds = await getBracket(competitionId);
  if (rounds.length === 0) {
    throw new AppError("Seed the bracket first.", 409, "NO_BRACKET");
  }
  // "Most advanced round" by progression rank, not the alphabetical order
  // getBracket returns.
  const last = [...rounds].sort(
    (a, b) => (ROUND_RANK[b.round] || 0) - (ROUND_RANK[a.round] || 0),
  )[0];
  if (last.round === "Final") {
    throw new AppError(
      last.ties.every((t) => t.through)
        ? "The final is decided — this competition is complete."
        : "Play the final to complete the competition.",
      409,
      "ALREADY_COMPLETE",
    );
  }
  if (last.ties.some((t) => !t.through)) {
    throw new AppError(
      "Every tie in the current round must have a decided winner first.",
      409,
      "ROUND_NOT_COMPLETE",
    );
  }

  const winnerNames = last.ties.map((t) => t.through);
  const clubRows = await pool.query("SELECT id, name FROM clubs WHERE name = ANY($1::text[])", [
    winnerNames,
  ]);
  const idByName = new Map(clubRows.rows.map((r) => [r.name, r.id]));
  const winnerIds = winnerNames.map((n) => idByName.get(n));
  if (winnerIds.some((id) => id == null)) {
    throw new AppError("Could not resolve every round winner.", 500, "WINNER_LOOKUP_FAILED");
  }

  const nextLabel = roundNameForTeams(winnerIds.length);
  const base = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(base.getTime())) {
    throw new AppError("startDate must be a valid date.", 400, "VALIDATION_ERROR");
  }
  const legGap = Number(daysBetweenLegs) > 0 ? Number(daysBetweenLegs) : 7;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const exists = await client.query(
      "SELECT 1 FROM matches WHERE competition_id = $1 AND round_label = $2 LIMIT 1",
      [competitionId, nextLabel],
    );
    if (exists.rows.length > 0) {
      throw new AppError(`The ${nextLabel} already exist.`, 409, "NEXT_ROUND_EXISTS");
    }
    let created = 0;
    for (let i = 0; i < winnerIds.length; i += 2) {
      const a = winnerIds[i];
      const b = winnerIds[i + 1];
      await insertScheduled(client, competitionId, nextLabel, 1, a, b, base);
      await insertScheduled(
        client,
        competitionId,
        nextLabel,
        2,
        b,
        a,
        new Date(base.getTime() + legGap * MS_PER_DAY),
      );
      created += 2;
    }
    await client.query("COMMIT");
    return { round: nextLabel, ties: winnerIds.length / 2, created };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
