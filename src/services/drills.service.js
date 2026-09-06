import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { estimateMinutes } from "../utils/drillTiming.js";

const UNIT_KINDS = ["reps", "secs"];
const LEVELS = ["Beginner", "Intermediate", "Elite"];
const POSITION_GROUPS = ["outfield", "goalkeeper", "all"];

function toPublicDrill(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    positionGroup: row.position_group,
    unitKind: row.unit_kind,
    sets: row.default_sets,
    reps: row.default_reps,
    secondsPerSet: row.seconds_per_set,
    minSets: row.min_sets,
    maxSets: row.max_sets,
    minReps: row.min_reps,
    maxReps: row.max_reps,
    active: row.active,
    demoVideoUrl: row.demo_video_url,
    boosts: row.boosts,
    durationMinutes: estimateMinutes(row.unit_kind, row.default_sets, row.default_reps, row.seconds_per_set),
    level: row.level,
    focusLabel: row.focus_label,
    coachDisplayName: row.coach_display_name,
    completionsCount: row.completions_count,
    rating: Number(row.rating),
    setupText: row.setup_text,
    executionText: row.execution_text,
    ruleText: row.rule_text,
  };
}

const DRILL_SELECT = `
  SELECT
    drills.*,
    COALESCE(
      jsonb_object_agg(attributes.code, drill_attribute_boosts.boost_value)
        FILTER (WHERE attributes.code IS NOT NULL),
      '{}'
    ) AS boosts
  FROM drills
  LEFT JOIN drill_attribute_boosts ON drill_attribute_boosts.drill_id = drills.id
  LEFT JOIN attributes ON attributes.id = drill_attribute_boosts.attribute_id
`;

export async function listDrills({ includeInactive = false } = {}) {
  const where = includeInactive ? "" : "WHERE drills.active";
  const result = await pool.query(
    `${DRILL_SELECT} ${where} GROUP BY drills.id ORDER BY drills.id`,
  );
  return result.rows.map(toPublicDrill);
}

async function loadDrill(client, id) {
  const result = await client.query(
    `${DRILL_SELECT} WHERE drills.id = $1 GROUP BY drills.id`,
    [id],
  );
  if (!result.rows[0]) {
    throw new AppError("Drill not found.", 404, "DRILL_NOT_FOUND");
  }
  return toPublicDrill(result.rows[0]);
}

function validateBounds({ minSets, maxSets, minReps, maxReps, defaultSets, defaultReps }) {
  const ints = { minSets, maxSets, minReps, maxReps, defaultSets, defaultReps };
  for (const [k, v] of Object.entries(ints)) {
    if (!Number.isInteger(v) || v < 1) {
      throw new AppError(`${k} must be a whole number of 1 or more.`, 400, "VALIDATION_ERROR");
    }
  }
  if (maxSets < minSets || maxReps < minReps) {
    throw new AppError("A max cap cannot be below its matching min.", 400, "VALIDATION_ERROR");
  }
  if (defaultSets < minSets || defaultSets > maxSets || defaultReps < minReps || defaultReps > maxReps) {
    throw new AppError("The default sets/reps must sit inside the caps.", 400, "VALIDATION_ERROR");
  }
}

async function validateBoosts(client, boosts) {
  if (!Array.isArray(boosts) || boosts.length === 0) {
    throw new AppError("A drill must boost at least one attribute.", 400, "VALIDATION_ERROR");
  }
  const codes = [];
  for (const b of boosts) {
    if (!b || typeof b.code !== "string" || ![1, 2, 3].includes(b.value)) {
      throw new AppError("Each boost needs a code and a value of 1, 2 or 3.", 400, "VALIDATION_ERROR");
    }
    codes.push(b.code);
  }
  const found = await client.query("SELECT code FROM attributes WHERE code = ANY($1::text[])", [codes]);
  const known = new Set(found.rows.map((r) => r.code));
  for (const code of codes) {
    if (!known.has(code)) {
      throw new AppError(`Unknown attribute "${code}".`, 400, "UNKNOWN_ATTRIBUTE");
    }
  }
}

async function writeBoosts(client, drillId, boosts) {
  await client.query("DELETE FROM drill_attribute_boosts WHERE drill_id = $1", [drillId]);
  for (const b of boosts) {
    await client.query(
      `INSERT INTO drill_attribute_boosts (drill_id, attribute_id, boost_value)
       SELECT $1, attributes.id, $3 FROM attributes WHERE attributes.code = $2`,
      [drillId, b.code, b.value],
    );
  }
}

export async function createDrill(payload) {
  const {
    name,
    category,
    level = "Intermediate",
    unitKind = "reps",
    defaultSets,
    defaultReps,
    secondsPerSet,
    minSets = 1,
    maxSets = 20,
    minReps = 1,
    maxReps = 300,
    positionGroup = null,
    focusLabel = "",
    demoVideoUrl = null,
    active = true,
    boosts,
  } = payload;

  if (!name || !name.trim()) throw new AppError("Drill name is required.", 400, "VALIDATION_ERROR");
  if (!category || !category.trim()) throw new AppError("Category is required.", 400, "VALIDATION_ERROR");
  if (!UNIT_KINDS.includes(unitKind)) {
    throw new AppError(`unitKind must be one of: ${UNIT_KINDS.join(", ")}.`, 400, "VALIDATION_ERROR");
  }
  if (!LEVELS.includes(level)) {
    throw new AppError(`level must be one of: ${LEVELS.join(", ")}.`, 400, "VALIDATION_ERROR");
  }
  if (positionGroup != null && !POSITION_GROUPS.includes(positionGroup)) {
    throw new AppError(`positionGroup must be one of: ${POSITION_GROUPS.join(", ")}.`, 400, "VALIDATION_ERROR");
  }
  if (!Number.isInteger(secondsPerSet) || secondsPerSet < 1) {
    throw new AppError("secondsPerSet must be a whole number of 1 or more.", 400, "VALIDATION_ERROR");
  }
  validateBounds({ minSets, maxSets, minReps, maxReps, defaultSets, defaultReps });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await validateBoosts(client, boosts);
    const inserted = await client.query(
      `INSERT INTO drills
         (name, category, position_group, unit_kind, default_sets, default_reps, seconds_per_set,
          min_sets, max_sets, min_reps, max_reps, level, focus_label, demo_video_url, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        name.trim(), category.trim(), positionGroup, unitKind, defaultSets, defaultReps, secondsPerSet,
        minSets, maxSets, minReps, maxReps, level, focusLabel || "", demoVideoUrl, active,
      ],
    );
    const drillId = inserted.rows[0].id;
    await writeBoosts(client, drillId, boosts);
    const drill = await loadDrill(client, drillId);
    await client.query("COMMIT");
    return drill;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const COLUMN_FOR = {
  name: "name",
  category: "category",
  positionGroup: "position_group",
  unitKind: "unit_kind",
  defaultSets: "default_sets",
  defaultReps: "default_reps",
  secondsPerSet: "seconds_per_set",
  minSets: "min_sets",
  maxSets: "max_sets",
  minReps: "min_reps",
  maxReps: "max_reps",
  level: "level",
  focusLabel: "focus_label",
  demoVideoUrl: "demo_video_url",
  active: "active",
};

export async function updateDrill(id, patch) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await loadDrill(client, id);

    const merged = {
      minSets: patch.minSets ?? current.minSets,
      maxSets: patch.maxSets ?? current.maxSets,
      minReps: patch.minReps ?? current.minReps,
      maxReps: patch.maxReps ?? current.maxReps,
      defaultSets: patch.defaultSets ?? current.sets,
      defaultReps: patch.defaultReps ?? current.reps,
    };
    validateBounds(merged);
    if (patch.unitKind != null && !UNIT_KINDS.includes(patch.unitKind)) {
      throw new AppError("Invalid unitKind.", 400, "VALIDATION_ERROR");
    }
    if (patch.level != null && !LEVELS.includes(patch.level)) {
      throw new AppError("Invalid level.", 400, "VALIDATION_ERROR");
    }
    if (patch.positionGroup != null && !POSITION_GROUPS.includes(patch.positionGroup)) {
      throw new AppError("Invalid positionGroup.", 400, "VALIDATION_ERROR");
    }

    const sets = [];
    const values = [];
    for (const [key, column] of Object.entries(COLUMN_FOR)) {
      if (patch[key] !== undefined) {
        values.push(key === "name" || key === "category" ? String(patch[key]).trim() : patch[key]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (sets.length > 0) {
      values.push(id);
      await client.query(`UPDATE drills SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    }

    if (patch.boosts !== undefined) {
      await validateBoosts(client, patch.boosts);
      await writeBoosts(client, id, patch.boosts);
    }

    const drill = await loadDrill(client, id);
    await client.query("COMMIT");
    return drill;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function setDrillActive(id, active) {
  const result = await pool.query("UPDATE drills SET active = $1 WHERE id = $2 RETURNING id", [
    active,
    id,
  ]);
  if (result.rows.length === 0) {
    throw new AppError("Drill not found.", 404, "DRILL_NOT_FOUND");
  }
  const client = await pool.connect();
  try {
    return await loadDrill(client, id);
  } finally {
    client.release();
  }
}
