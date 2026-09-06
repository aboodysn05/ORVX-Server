import "dotenv/config";
import bcrypt from "bcryptjs";
import pool from "../db/pool.js";
import { PLATFORM_EVALUATOR_ORG } from "../utils/roles.js";
import { keysFor, computeOverall, tierFor } from "../utils/playerRating.js";

// Wipes all app data (keeps the migration-seeded reference data: attributes,
// the 10 base drills, competitions + their matches, the 8 club identities) and
// loads a rich demo dataset so every frontend page has something to show.
//
//   npm run seed:demo
//
// All demo accounts use the password `demo1234` and emails ending @demo.orvx.

const PASSWORD = "demo1234";

const ORIGINAL_CLUBS = [
  { id: 1, name: "Northgate FC", crest: "NGF", slot: 1, division: "Division A" },
  { id: 2, name: "Riverside United", crest: "RIV", slot: 2, division: "Division A" },
  { id: 3, name: "Eastside Rangers", crest: "ESR", slot: 3, division: "Division A" },
  { id: 4, name: "Harbour Athletic", crest: "HAR", slot: 4, division: "Division A" },
  { id: 5, name: "Kingsway Town", crest: "KIN", slot: 5, division: "Division B" },
  { id: 6, name: "Meadow Park FC", crest: "MPF", slot: 6, division: "Division B" },
  { id: 7, name: "Central Wanderers", crest: "CWN", slot: 7, division: "Division B" },
  { id: 8, name: "Lakeside Rovers", crest: "LKR", slot: 8, division: "Division B" },
];

const FIRST = ["Jae", "Leo", "Sam", "Theo", "Kof", "Dane", "Rui", "Alex", "Nico", "Omar", "Bram", "Yuki", "Ivan", "Cole", "Finn", "Ade"];
const LAST = ["Adeyemi", "Moreau", "Novak", "Okonkwo", "Boyd", "Ferreira", "Nunez", "Reed", "Haddad", "Kerr", "Vane", "Ito", "Petrov", "Webb", "Frost", "Bello"];

const OUTFIELD_BASE = { pace: 74, shooting: 68, passing: 70, dribbling: 72, defending: 58, physical: 66 };
const GK_BASE = { diving: 72, handling: 70, kicking: 64, reflexes: 75, speed: 60, positioning: 70 };

const rand = (n) => Math.floor(Math.random() * n);
const jitter = (base) => {
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = Math.max(30, Math.min(95, v + rand(21) - 10));
  return out;
};

const hash = await bcrypt.hash(PASSWORD, 10);
const client = await pool.connect();

async function makeUser(name, email, role, organization = null) {
  const r = await client.query(
    `INSERT INTO users (name, email, password_hash, role, organization)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name, email, hash, role, organization],
  );
  return r.rows[0].id;
}

async function makePlayer(name, email, position) {
  const userId = await makeUser(name, email, "player");
  const base = position === "Goalkeeper" ? GK_BASE : OUTFIELD_BASE;
  const attrs = jitter(base);
  const overall = computeOverall(position, attrs);
  const foot = ["Left", "Right", "Both"][rand(3)];
  const playerRes = await client.query(
    `INSERT INTO players (user_id, position, dominant_foot, height_cm, weight_kg, overall, tier)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [userId, position, foot, 168 + rand(24), 62 + rand(24), overall, tierFor(overall)],
  );
  const playerId = playerRes.rows[0].id;
  for (const key of keysFor(position)) {
    await client.query(
      `INSERT INTO player_attributes (player_id, attribute_id, value)
       SELECT $1, id, $3 FROM attributes WHERE code = $2`,
      [playerId, key, attrs[key]],
    );
  }
  return { userId, playerId, name };
}

// A single-drill baseline submission in a given review state.
async function makeBaselineSubmission(playerId, { reviewStatus, reviewerCoachId = null, daysAgo = 1 }) {
  const drillId = 1 + rand(6); // one of the six outfield seeded drills
  const drillRes = await client.query(
    `SELECT d.name, d.unit_kind, d.default_sets, d.default_reps,
       COALESCE(jsonb_object_agg(a.code, b.boost_value) FILTER (WHERE a.code IS NOT NULL), '{}') AS boosts
     FROM drills d
     LEFT JOIN drill_attribute_boosts b ON b.drill_id = d.id
     LEFT JOIN attributes a ON a.id = b.attribute_id
     WHERE d.id = $1 GROUP BY d.id`,
    [drillId],
  );
  const drill = drillRes.rows[0];
  const submittedAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
  const reviewedAt = reviewStatus === "pending" ? null : submittedAt;
  const subRes = await client.query(
    `INSERT INTO drill_submissions
       (player_id, name, focus, total_time_minutes, status, video_url, notes,
        review_status, reviewer_coach_id, submitted_at, reviewed_at, started_at, completed_at)
     VALUES ($1, 'Baseline session', 'Baseline', 24, 'submitted',
             'https://example.com/clip.mp4', 'Filmed at the training cage.',
             $2, $3, $4, $5, $4, $4) RETURNING id`,
    [playerId, reviewStatus, reviewerCoachId, submittedAt, reviewedAt],
  );
  await client.query(
    `INSERT INTO drill_submission_drills
       (drill_submission_id, drill_id, position, name, unit_kind, sets, reps, boosts, progress)
     VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8)`,
    [
      subRes.rows[0].id, drillId, drill.name, drill.unit_kind,
      drill.default_sets, drill.default_reps, JSON.stringify(drill.boosts),
      JSON.stringify(Array(drill.default_sets).fill(true)),
    ],
  );
  return subRes.rows[0].id;
}

try {
  await client.query("BEGIN");

  console.log("Wiping app data…");
  // DELETE (not TRUNCATE CASCADE) so FK ON DELETE rules apply: players /
  // coaches / applications / submissions / memberships cascade away, while
  // drills.created_by and *.reviewed_by just go NULL.
  await client.query("DELETE FROM users");
  await client.query("DELETE FROM drills WHERE id > 10");
  await client.query("UPDATE drills SET active = true");
  await client.query("DELETE FROM competitions WHERE id > 2"); // keep the 2 migration-seeded
  await client.query("DELETE FROM clubs WHERE id > 8");
  for (const c of ORIGINAL_CLUBS) {
    await client.query(
      `UPDATE clubs SET name = $2, crest_code = $3, slot = $4, division = $5,
         head_coach_id = NULL, archived = false, archived_at = NULL
       WHERE id = $1`,
      [c.id, c.name, c.crest, c.slot, c.division],
    );
  }

  console.log("Admin + Platform Evaluator…");
  await makeUser("Demo Admin", "admin@demo.orvx", "admin");
  const evalUserId = await makeUser("Coach #9", "evaluator@demo.orvx", "coach", PLATFORM_EVALUATOR_ORG);
  await client.query(
    `INSERT INTO coaches (user_id, display_name, is_platform_evaluator) VALUES ($1, 'Coach #9', true)`,
    [evalUserId],
  );

  console.log("Head coaches (clubs 1-4)…");
  const coachIds = [];
  for (const c of ORIGINAL_CLUBS.slice(0, 4)) {
    const slug = c.name.toLowerCase().replace(/[^a-z]/g, "");
    const uid = await makeUser(`Coach ${c.name}`, `coach.${slug}@demo.orvx`, "coach", c.name);
    const yrs = 5 + rand(10);
    const lic = `UEFA-B-${1000 + rand(9000)}`;
    const coachRes = await client.query(
      `INSERT INTO coaches (user_id, display_name, years_experience, license_number)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [uid, `Coach ${c.name}`, yrs, lic],
    );
    await client.query("UPDATE clubs SET head_coach_id = $1 WHERE id = $2", [coachRes.rows[0].id, c.id]);
    // an approved application so the coach nav shows the workspace links
    await client.query(
      `INSERT INTO coach_applications
         (user_id, full_name, years_experience, license_number, club_name, squad_capacity,
          credential_doc_url, status, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, 16, 'https://example.com/licence.pdf', 'approved', now())`,
      [uid, `Coach ${c.name}`, yrs, lic, c.name],
    );
    coachIds.push(coachRes.rows[0].id);
  }

  console.log("Pending coach applications…");
  for (let i = 1; i <= 2; i++) {
    const uid = await makeUser(`Applicant ${i}`, `applicant${i}@demo.orvx`, "coach", `New Club ${i}`);
    await client.query(
      `INSERT INTO coach_applications
         (user_id, full_name, years_experience, license_number, club_name, squad_capacity,
          credential_doc_url, club_logo_url, status)
       VALUES ($1, $2, $3, $4, $5, 16, 'https://example.com/licence.pdf', 'https://example.com/crest.png', 'pending')`,
      [uid, `Applicant ${i} Coach`, 4 + rand(8), `FA-L2-${100 + rand(900)}`, `Aspiring FC ${i}`],
    );
  }

  console.log("Players…");
  let pi = 0;
  const nextName = () => `${FIRST[pi % FIRST.length]} ${LAST[pi % LAST.length]}`;
  const nextEmail = () => `player${++pi}@demo.orvx`;
  const positions = ["Attacker", "Defender", "Goalkeeper"];

  // 4 baseline-pending (in the evaluator queue)
  for (let i = 0; i < 4; i++) {
    const pos = positions[i % 3];
    const p = await makePlayer(nextName(), nextEmail(), pos);
    await makeBaselineSubmission(p.playerId, { reviewStatus: "pending", daysAgo: 1 + i });
  }

  // 2 baseline-pending with a rejected submission
  for (let i = 0; i < 2; i++) {
    const p = await makePlayer(nextName(), nextEmail(), positions[i % 3]);
    await makeBaselineSubmission(p.playerId, { reviewStatus: "rejected", daysAgo: 3 + i });
  }

  // 6 released (approved baseline -> scouting pool)
  const released = [];
  for (let i = 0; i < 6; i++) {
    const p = await makePlayer(nextName(), nextEmail(), positions[i % 3]);
    await makeBaselineSubmission(p.playerId, { reviewStatus: "approved", daysAgo: 5 + i });
    released.push(p);
  }

  // 4 signed, spread across clubs 1-4
  for (let i = 0; i < 4; i++) {
    const p = await makePlayer(nextName(), nextEmail(), positions[i % 3]);
    await makeBaselineSubmission(p.playerId, {
      reviewStatus: "approved",
      reviewerCoachId: coachIds[i],
      daysAgo: 12 + i,
    });
    await client.query(
      `INSERT INTO club_memberships (club_id, player_id, position, active)
       VALUES ($1, $2, $3, true)`,
      [ORIGINAL_CLUBS[i].id, p.playerId, positions[i % 3]],
    );
  }

  console.log("Pending club applications…");
  for (let i = 0; i < 3; i++) {
    await client.query(
      `INSERT INTO club_applications (club_id, player_id, message, status)
       VALUES ($1, $2, $3, 'pending')`,
      [ORIGINAL_CLUBS[i].id, released[i].playerId, "Would love to join — ready to work."],
    );
  }

  await client.query("COMMIT");

  console.log("\nDemo data loaded. All passwords: %s\n", PASSWORD);
  console.log("  admin@demo.orvx            (admin)");
  console.log("  evaluator@demo.orvx        (Platform Evaluator)");
  console.log("  coach.northgatefc@demo.orvx … coach.harbourathletic@demo.orvx  (head coaches)");
  console.log("  applicant1@demo.orvx, applicant2@demo.orvx   (pending coach applications)");
  console.log("  player1@demo.orvx … player16@demo.orvx        (mixed lifecycle states)");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("seed:demo failed:", err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
