import pool from "../db/pool.js";
import { SQUAD_CAP } from "../utils/constants.js";

// Landing-page aggregate for the Sys-Admin console (GET /admin/overview).
// There is no separate audit-log table — the "activity" feed is assembled
// from the timestamped rows the admin console already produces (coach
// applications reviewed, clubs provisioned / archived, matches played).

const NEAR_CAP_GAP = 2; // "near capacity" = within this many slots of the cap

export async function getAdminOverview() {
  const [
    pendingCoach,
    clubRows,
    resultsOutstanding,
    drillCounts,
    coachesApproved,
    clubsProvisioned,
    clubsArchived,
    playersRegistered,
    submissionsApproved,
  ] = await Promise.all([
    pool.query("SELECT count(*)::int AS n FROM coach_applications WHERE status = 'pending'"),
    pool.query(
      `SELECT cl.id,
              (SELECT count(*)::int FROM club_memberships m WHERE m.club_id = cl.id AND m.active) AS roster_count
       FROM clubs cl
       WHERE cl.archived = false`,
    ),
    pool.query("SELECT count(*)::int AS n FROM matches WHERE status = 'scheduled'"),
    pool.query(
      `SELECT count(*) FILTER (WHERE active)::int AS active,
              count(*) FILTER (WHERE NOT active)::int AS retired
       FROM drills`,
    ),
    pool.query("SELECT count(*)::int AS n FROM coach_applications WHERE status = 'approved'"),
    pool.query(
      "SELECT count(*)::int AS n FROM clubs WHERE head_coach_id IS NOT NULL AND archived = false",
    ),
    pool.query("SELECT count(*)::int AS n FROM clubs WHERE archived = true"),
    pool.query("SELECT count(*)::int AS n FROM players"),
    pool.query("SELECT count(*)::int AS n FROM drill_submissions WHERE review_status = 'approved'"),
  ]);

  const nearCapacity = clubRows.rows.filter(
    (c) => c.roster_count >= SQUAD_CAP - NEAR_CAP_GAP && c.roster_count < SQUAD_CAP,
  ).length;
  const atCapacity = clubRows.rows.filter((c) => c.roster_count >= SQUAD_CAP).length;

  return {
    snapshot: {
      pendingCoachRequests: pendingCoach.rows[0].n,
      clubsNearCapacity: nearCapacity,
      clubsAtCapacity: atCapacity,
      resultsOutstanding: resultsOutstanding.rows[0].n,
      activeDrills: drillCounts.rows[0].active,
      retiredDrills: drillCounts.rows[0].retired,
    },
    season: {
      coachesApproved: coachesApproved.rows[0].n,
      clubsProvisioned: clubsProvisioned.rows[0].n,
      clubsArchived: clubsArchived.rows[0].n,
      playersRegistered: playersRegistered.rows[0].n,
      submissionsApproved: submissionsApproved.rows[0].n,
    },
    activity: await buildActivity(),
  };
}

async function buildActivity() {
  const [coachApps, clubsMade, clubsGone, matchesPlayed] = await Promise.all([
    pool.query(
      `SELECT ca.reviewed_at AS ts, ca.status, ca.full_name, ca.club_name
       FROM coach_applications ca
       WHERE ca.reviewed_at IS NOT NULL
       ORDER BY ca.reviewed_at DESC LIMIT 10`,
    ),
    pool.query(
      `SELECT cl.created_at AS ts, cl.name
       FROM clubs cl
       WHERE cl.head_coach_id IS NOT NULL
       ORDER BY cl.created_at DESC LIMIT 10`,
    ),
    pool.query(
      `SELECT cl.archived_at AS ts, cl.name
       FROM clubs cl
       WHERE cl.archived = true AND cl.archived_at IS NOT NULL
       ORDER BY cl.archived_at DESC LIMIT 10`,
    ),
    pool.query(
      `SELECT f.scheduled_at AS ts, f.home_score, f.away_score,
              hc.crest_code AS home_crest, ac.crest_code AS away_crest,
              comp.name AS competition_name
       FROM matches f
       JOIN clubs hc ON hc.id = f.home_club_id
       JOIN clubs ac ON ac.id = f.away_club_id
       JOIN competitions comp ON comp.id = f.competition_id
       WHERE f.status = 'played'
       ORDER BY f.scheduled_at DESC LIMIT 10`,
    ),
  ]);

  const items = [];
  for (const r of coachApps.rows) {
    const approved = r.status === "approved";
    items.push({
      ts: r.ts,
      kind: "Access",
      action: approved ? "APPROVED_COACH" : "DECLINED_COACH_REQUEST",
      target: `${r.full_name} · ${r.club_name}`,
      status: approved ? "SUCCESS" : "REVERTED",
    });
  }
  for (const r of clubsMade.rows) {
    items.push({
      ts: r.ts,
      kind: "Access",
      action: "PROVISIONED_CLUB",
      target: `Club: ${r.name}`,
      status: "SUCCESS",
    });
  }
  for (const r of clubsGone.rows) {
    items.push({
      ts: r.ts,
      kind: "Access",
      action: "ARCHIVED_CLUB",
      target: `Club: ${r.name}`,
      status: "SUCCESS",
    });
  }
  for (const r of matchesPlayed.rows) {
    items.push({
      ts: r.ts,
      kind: "Results",
      action: "COMMITTED_RESULT",
      target: `${r.home_crest} ${r.home_score}–${r.away_score} ${r.away_crest} · ${r.competition_name}`,
      status: "SUCCESS",
    });
  }

  return items
    .filter((i) => i.ts)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, 15)
    .map((i) => ({ ...i, ts: new Date(i.ts).toISOString() }));
}
