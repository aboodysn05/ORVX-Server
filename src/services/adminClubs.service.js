import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { SQUAD_CAP, CLUB_SLOTS } from "../utils/constants.js";

// Admin club-allocation console: provision a club into a free slot (1-8),
// archive one (frees its slot, dumps its roster back to the scouting pool,
// revokes the head coach), or restore an archived club into a free slot.

function crestFor(name) {
  const letters = (name || "").replace(/[^a-zA-Z]/g, "");
  return letters ? letters.slice(0, 3).toUpperCase() : "CLB";
}

function toAdminClub(row) {
  return {
    id: row.id,
    name: row.name,
    crestCode: row.crest_code,
    slot: row.slot,
    division: row.division,
    archived: row.archived,
    archivedAt: row.archived_at,
    headCoachId: row.head_coach_id,
    headCoachName: row.head_coach_name ?? null,
    rosterCount: row.roster_count ?? 0,
    squadCap: SQUAD_CAP,
    isFull: (row.roster_count ?? 0) >= SQUAD_CAP,
    createdAt: row.created_at,
  };
}

export async function listClubsAdmin() {
  const result = await pool.query(
    `SELECT cl.*, COALESCE(co.display_name, u.name) AS head_coach_name,
            (SELECT count(*)::int FROM club_memberships m WHERE m.club_id = cl.id AND m.active) AS roster_count
     FROM clubs cl
     LEFT JOIN coaches co ON co.id = cl.head_coach_id
     LEFT JOIN users u ON u.id = co.user_id
     ORDER BY cl.slot NULLS LAST, cl.name`,
  );
  return result.rows.map(toAdminClub);
}

async function lowestFreeSlot(client) {
  const result = await client.query(
    `SELECT gs AS slot FROM generate_series(1, $1) gs
     WHERE gs NOT IN (SELECT slot FROM clubs WHERE slot IS NOT NULL)
     ORDER BY gs LIMIT 1`,
    [CLUB_SLOTS],
  );
  return result.rows[0]?.slot ?? null;
}

export async function provisionClub({ name, division }) {
  if (!name || !name.trim()) {
    throw new AppError("Club name is required.", 400, "VALIDATION_ERROR");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const slot = await lowestFreeSlot(client);
    if (slot == null) {
      throw new AppError("All 8 club slots are in use — archive a club first.", 409, "NO_FREE_CLUB_SLOT");
    }
    let club;
    try {
      const inserted = await client.query(
        `INSERT INTO clubs (name, crest_code, slot, division) VALUES ($1, $2, $3, $4) RETURNING *`,
        [name.trim(), crestFor(name), slot, division || null],
      );
      club = inserted.rows[0];
    } catch (err) {
      if (err.code === "23505") {
        throw new AppError("A club with that name already exists.", 409, "CLUB_NAME_TAKEN");
      }
      throw err;
    }
    await client.query("COMMIT");
    return toAdminClub(club);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function archiveClub(clubId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM clubs WHERE id = $1 FOR UPDATE", [clubId]);
    const club = existing.rows[0];
    if (!club) {
      throw new AppError("Club not found.", 404, "CLUB_NOT_FOUND");
    }
    if (club.archived) {
      throw new AppError("This club is already archived.", 409, "CLUB_ALREADY_ARCHIVED");
    }
    // Roster back to the scouting pool.
    await client.query(
      "UPDATE club_memberships SET active = false, released_at = now() WHERE club_id = $1 AND active",
      [clubId],
    );
    const updated = await client.query(
      `UPDATE clubs
       SET archived = true, archived_at = now(), slot = NULL, head_coach_id = NULL
       WHERE id = $1 RETURNING *`,
      [clubId],
    );
    await client.query("COMMIT");
    return toAdminClub(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function restoreClub(clubId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM clubs WHERE id = $1 FOR UPDATE", [clubId]);
    const club = existing.rows[0];
    if (!club) {
      throw new AppError("Club not found.", 404, "CLUB_NOT_FOUND");
    }
    if (!club.archived) {
      throw new AppError("This club is not archived.", 409, "CLUB_NOT_ARCHIVED");
    }
    const slot = await lowestFreeSlot(client);
    if (slot == null) {
      throw new AppError("No free slot to restore into — archive a club first.", 409, "NO_FREE_CLUB_SLOT");
    }
    const updated = await client.query(
      `UPDATE clubs SET archived = false, archived_at = NULL, slot = $1 WHERE id = $2 RETURNING *`,
      [slot, clubId],
    );
    await client.query("COMMIT");
    return toAdminClub(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
