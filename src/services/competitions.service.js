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
      FROM fixtures f WHERE f.competition_id = $1 AND f.status = 'played'
      UNION ALL
      SELECT f.scheduled_at, f.away_club_id, f.away_score, f.home_score
      FROM fixtures f WHERE f.competition_id = $1 AND f.status = 'played'
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
    SELECT f.id, f.round_label, f.leg, f.home_score, f.away_score, f.status, f.scheduled_at,
      hc.name AS home_name, ac.name AS away_name
    FROM fixtures f
    JOIN clubs hc ON hc.id = f.home_club_id
    JOIN clubs ac ON ac.id = f.away_club_id
    WHERE f.competition_id = $1
    ORDER BY f.scheduled_at
    `,
    [competitionId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    round: row.round_label,
    leg: row.leg,
    home: row.home_name,
    away: row.away_name,
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    scheduledAt: row.scheduled_at,
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
    FROM fixtures f
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

  return { rounds };
}
