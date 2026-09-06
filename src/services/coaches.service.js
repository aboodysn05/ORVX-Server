import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

// Coach onboarding: a coach user submits a club-management request; an admin
// approves it (provisioning a club into a free slot and linking the coach as
// its head coach) or declines it. `GET /coaches` is the directory the player's
// reviewer picker reads.

function crestFor(name) {
  const letters = (name || "").replace(/[^a-zA-Z]/g, "");
  return letters ? letters.slice(0, 3).toUpperCase() : "CLB";
}

function toPublicApplication(row) {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    yearsExperience: row.years_experience,
    licenseNumber: row.license_number,
    clubName: row.club_name,
    squadCapacity: row.squad_capacity,
    credentialDocUrl: row.credential_doc_url,
    clubLogoUrl: row.club_logo_url,
    status: row.status,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
  };
}

function validateApplication(payload) {
  const { fullName, yearsExperience, clubName, squadCapacity } = payload;
  if (!fullName || !fullName.trim()) {
    throw new AppError("Full name is required.", 400, "VALIDATION_ERROR");
  }
  if (!Number.isInteger(yearsExperience) || yearsExperience < 0) {
    throw new AppError("Years of experience must be a whole number of 0 or more.", 400, "VALIDATION_ERROR");
  }
  if (!clubName || !clubName.trim()) {
    throw new AppError("Club name is required.", 400, "VALIDATION_ERROR");
  }
  const cap = squadCapacity ?? 16;
  if (!Number.isInteger(cap) || cap < 1 || cap > 16) {
    throw new AppError("Squad capacity must be a whole number between 1 and 16.", 400, "VALIDATION_ERROR");
  }
}

export async function applyAsCoach(userId, payload) {
  validateApplication(payload);
  try {
    const result = await pool.query(
      `INSERT INTO coach_applications
         (user_id, full_name, years_experience, license_number, club_name, squad_capacity,
          credential_doc_url, club_logo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        payload.fullName.trim(),
        payload.yearsExperience,
        payload.licenseNumber || null,
        payload.clubName.trim(),
        payload.squadCapacity ?? 16,
        payload.credentialDocUrl || null,
        payload.clubLogoUrl || null,
      ],
    );
    return toPublicApplication(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("You already have a pending application.", 409, "APPLICATION_PENDING");
    }
    throw err;
  }
}

export async function getMyCoachApplication(userId) {
  const result = await pool.query(
    "SELECT * FROM coach_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId],
  );
  return result.rows[0] ? toPublicApplication(result.rows[0]) : null;
}

export async function listCoachApplications({ status } = {}) {
  const params = [];
  let where = "";
  if (status) {
    params.push(status);
    where = "WHERE ca.status = $1";
  }
  const result = await pool.query(
    `SELECT ca.*, u.name AS applicant_name, u.email AS applicant_email
     FROM coach_applications ca
     JOIN users u ON u.id = ca.user_id
     ${where}
     ORDER BY ca.created_at DESC`,
    params,
  );
  return result.rows.map(toPublicApplication);
}

export async function getCoachApplication(id) {
  const result = await pool.query(
    `SELECT ca.*, u.name AS applicant_name, u.email AS applicant_email
     FROM coach_applications ca
     JOIN users u ON u.id = ca.user_id
     WHERE ca.id = $1`,
    [id],
  );
  if (!result.rows[0]) {
    throw new AppError("Coach application not found.", 404, "APPLICATION_NOT_FOUND");
  }
  return toPublicApplication(result.rows[0]);
}

export async function approveCoachApplication(applicationId, adminUserId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const appResult = await client.query(
      "SELECT * FROM coach_applications WHERE id = $1 FOR UPDATE",
      [applicationId],
    );
    const application = appResult.rows[0];
    if (!application) {
      throw new AppError("Coach application not found.", 404, "APPLICATION_NOT_FOUND");
    }
    if (application.status !== "pending") {
      throw new AppError("This application has already been decided.", 409, "APPLICATION_NOT_PENDING");
    }

    // The 8 official club slots are seeded. Approving a coach claims the
    // lowest-numbered slot that has no head coach yet (and isn't archived) and
    // rebrands it to the coach's club name.
    const slotResult = await client.query(
      `SELECT id FROM clubs
       WHERE head_coach_id IS NULL AND archived = false
       ORDER BY slot NULLS LAST, id
       LIMIT 1 FOR UPDATE`,
    );
    if (!slotResult.rows[0]) {
      throw new AppError(
        "All 8 club slots already have a head coach — archive a club first.",
        409,
        "NO_FREE_CLUB_SLOT",
      );
    }
    const clubId = slotResult.rows[0].id;

    const coachResult = await client.query(
      `INSERT INTO coaches (user_id, display_name, years_experience, license_number, credential_doc_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         years_experience = EXCLUDED.years_experience,
         license_number = EXCLUDED.license_number,
         credential_doc_url = EXCLUDED.credential_doc_url
       RETURNING *`,
      [
        application.user_id,
        application.full_name,
        application.years_experience,
        application.license_number,
        application.credential_doc_url,
      ],
    );
    const coach = coachResult.rows[0];

    let club;
    try {
      const clubResult = await client.query(
        `UPDATE clubs
         SET name = $1, crest_code = $2, head_coach_id = $3
         WHERE id = $4 RETURNING *`,
        [application.club_name.trim(), crestFor(application.club_name), coach.id, clubId],
      );
      club = clubResult.rows[0];
    } catch (err) {
      if (err.code === "23505") {
        throw new AppError("A club with that name already exists.", 409, "CLUB_NAME_TAKEN");
      }
      throw err;
    }

    const updatedApp = await client.query(
      `UPDATE coach_applications
       SET status = 'approved', reviewed_by = $1, reviewed_at = now()
       WHERE id = $2 RETURNING *`,
      [adminUserId, applicationId],
    );

    await client.query("COMMIT");
    return {
      application: toPublicApplication(updatedApp.rows[0]),
      club,
      coach: {
        id: coach.id,
        userId: coach.user_id,
        displayName: coach.display_name,
        isPlatformEvaluator: coach.is_platform_evaluator,
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function declineCoachApplication(applicationId, adminUserId, note) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const appResult = await client.query(
      "SELECT * FROM coach_applications WHERE id = $1 FOR UPDATE",
      [applicationId],
    );
    const application = appResult.rows[0];
    if (!application) {
      throw new AppError("Coach application not found.", 404, "APPLICATION_NOT_FOUND");
    }
    if (application.status !== "pending") {
      throw new AppError("This application has already been decided.", 409, "APPLICATION_NOT_PENDING");
    }
    const updated = await client.query(
      `UPDATE coach_applications
       SET status = 'declined', review_note = $1, reviewed_by = $2, reviewed_at = now()
       WHERE id = $3 RETURNING *`,
      [note || null, adminUserId, applicationId],
    );
    await client.query("COMMIT");
    return toPublicApplication(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// The up-to-8 club head coaches, for the player's reviewer picker.
export async function listCoaches() {
  const result = await pool.query(
    `SELECT c.id AS coach_id, c.user_id, c.display_name, u.name AS user_name,
            cl.id AS club_id, cl.name AS club_name, cl.division
     FROM coaches c
     JOIN users u ON u.id = c.user_id
     JOIN clubs cl ON cl.head_coach_id = c.id AND cl.archived = false
     WHERE c.is_platform_evaluator = false
     ORDER BY cl.slot NULLS LAST, cl.name`,
  );
  return result.rows.map((row) => ({
    coachId: row.coach_id,
    userId: row.user_id,
    name: row.display_name || row.user_name,
    clubId: row.club_id,
    clubName: row.club_name,
    division: row.division,
  }));
}
