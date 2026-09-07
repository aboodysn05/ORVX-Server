import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { SQUAD_CAP } from "../utils/constants.js";
import { getStandings } from "./competitions.service.js";

// Aggregate for the Coach Club Profile page (GET /clubs/:id/overview): the
// club's standings row, roster size + positional composition, the count of
// approved training submissions credited to the club, its last few results
// and its next scheduled fixture. Everything is derived from existing tables.

const POSITION_GROUPS = ["Attacker", "Defender", "Goalkeeper"];
// Platform-wide match format — a rule, not per-club data.
const PLATFORM_FORMAT = "5v5 · Indoor";

function roundAvg(values) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
}

export async function getClubOverview(clubId) {
  const clubResult = await pool.query(
    `SELECT cl.id, cl.name, cl.crest_code, cl.slot, cl.division, cl.archived, cl.created_at,
            cl.head_coach_id,
            COALESCE(co.display_name, u.name) AS head_coach_name,
            u.email AS head_coach_email
     FROM clubs cl
     LEFT JOIN coaches co ON co.id = cl.head_coach_id
     LEFT JOIN users u ON u.id = co.user_id
     WHERE cl.id = $1`,
    [clubId],
  );
  const club = clubResult.rows[0];
  if (!club) {
    throw new AppError("Club not found.", 404, "CLUB_NOT_FOUND");
  }

  // --- roster + positional composition ---
  const rosterResult = await pool.query(
    `SELECT p.position, p.overall
     FROM club_memberships m
     JOIN players p ON p.id = m.player_id
     WHERE m.club_id = $1 AND m.active`,
    [clubId],
  );
  const roster = rosterResult.rows;
  const rosterCount = roster.length;
  const averageOverall = roundAvg(roster.map((r) => Number(r.overall)));
  const composition = POSITION_GROUPS.map((position) => {
    const group = roster.filter((r) => r.position === position);
    return {
      position,
      count: group.length,
      averageOverall: roundAvg(group.map((r) => Number(r.overall))),
    };
  });

  // --- approved training submissions credited to this club ---
  // A submission counts if it was routed to this club's head coach OR the
  // player who filed it is on the club's current active roster.
  const verifiedResult = await pool.query(
    `SELECT count(*)::int AS n
     FROM drill_submissions ds
     WHERE ds.review_status = 'approved'
       AND (
         ($2::int IS NOT NULL AND ds.reviewer_coach_id = $2)
         OR ds.player_id IN (
           SELECT player_id FROM club_memberships WHERE club_id = $1 AND active
         )
       )`,
    [clubId, club.head_coach_id],
  );
  const verifiedSessions = verifiedResult.rows[0].n;

  // --- league standings row (a club sits in at most one league) ---
  let league = null;
  const leagues = await pool.query(
    "SELECT id, name FROM competitions WHERE type = 'league' ORDER BY id",
  );
  for (const competition of leagues.rows) {
    const standings = await getStandings(competition.id);
    const row = standings.find((s) => s.clubId === clubId);
    if (row) {
      league = {
        competitionId: competition.id,
        competitionName: competition.name,
        position: row.position,
        totalClubs: standings.length,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDiff: row.goalDiff,
        points: row.points,
        form: row.form,
      };
      break;
    }
  }

  // --- recent results + next fixture, from every match this club is in ---
  const matchResult = await pool.query(
    `SELECT f.id, f.round_label, f.leg, f.status, f.scheduled_at,
            f.home_club_id, f.away_club_id, f.home_score, f.away_score,
            hc.name AS home_name, hc.crest_code AS home_crest,
            ac.name AS away_name, ac.crest_code AS away_crest,
            comp.name AS competition_name
     FROM matches f
     JOIN clubs hc ON hc.id = f.home_club_id
     JOIN clubs ac ON ac.id = f.away_club_id
     JOIN competitions comp ON comp.id = f.competition_id
     WHERE f.home_club_id = $1 OR f.away_club_id = $1
     ORDER BY f.scheduled_at`,
    [clubId],
  );

  const played = [];
  let nextFixture = null;
  for (const m of matchResult.rows) {
    const home = m.home_club_id === clubId;
    const opponent = home ? m.away_name : m.home_name;
    const opponentCrest = home ? m.away_crest : m.home_crest;
    if (m.status === "played") {
      const goalsFor = home ? m.home_score : m.away_score;
      const goalsAgainst = home ? m.away_score : m.home_score;
      played.push({
        matchId: m.id,
        competitionName: m.competition_name,
        round: m.round_label,
        opponent,
        opponentCrest,
        home,
        goalsFor,
        goalsAgainst,
        result: goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D",
        scheduledAt: m.scheduled_at,
      });
    } else if (!nextFixture) {
      nextFixture = {
        matchId: m.id,
        competitionName: m.competition_name,
        round: m.round_label,
        leg: m.leg,
        opponent,
        opponentCrest,
        home,
        scheduledAt: m.scheduled_at,
      };
    }
  }
  const recentResults = played.slice(-5).reverse();

  return {
    id: club.id,
    name: club.name,
    crestCode: club.crest_code,
    slot: club.slot,
    division: club.division,
    archived: club.archived,
    foundedYear: new Date(club.created_at).getUTCFullYear(),
    format: PLATFORM_FORMAT,
    headCoachName: club.head_coach_name,
    headCoachEmail: club.head_coach_email,
    squadCap: SQUAD_CAP,
    rosterCount,
    placesOpen: Math.max(0, SQUAD_CAP - rosterCount),
    averageOverall,
    composition,
    verifiedSessions,
    league,
    nextFixture,
    recentResults,
  };
}
