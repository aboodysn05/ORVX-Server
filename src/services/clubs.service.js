import pool from "../db/pool.js";
import { SQUAD_CAP } from "../utils/constants.js";
import { getStandings } from "./competitions.service.js";

// Public club list, now enriched with the head coach, active roster count and
// (if the club sits in a league) its current standings position. Existing
// keys (id, name, crestCode) are preserved; everything else is additive.
export async function listClubs() {
  const result = await pool.query(
    `SELECT cl.id, cl.name, cl.crest_code, cl.slot, cl.division, cl.archived,
            COALESCE(c.display_name, u.name) AS head_coach_name,
            (SELECT count(*)::int FROM club_memberships m WHERE m.club_id = cl.id AND m.active) AS roster_count
     FROM clubs cl
     LEFT JOIN coaches c ON c.id = cl.head_coach_id
     LEFT JOIN users u ON u.id = c.user_id
     -- head_coach_name below prefers the coach's display name
     ORDER BY cl.slot NULLS LAST, cl.name`,
  );

  // Map each club to its position in whichever league it plays in.
  const positionByClub = new Map();
  const leagues = await pool.query("SELECT id FROM competitions WHERE type = 'league'");
  for (const league of leagues.rows) {
    const standings = await getStandings(league.id);
    for (const row of standings) {
      if (!positionByClub.has(row.clubId)) positionByClub.set(row.clubId, row.position);
    }
  }

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    crestCode: row.crest_code,
    slot: row.slot,
    division: row.division,
    archived: row.archived,
    headCoachName: row.head_coach_name,
    rosterCount: row.roster_count,
    squadCap: SQUAD_CAP,
    isFull: row.roster_count >= SQUAD_CAP,
    leaguePosition: positionByClub.get(row.id) ?? null,
  }));
}
