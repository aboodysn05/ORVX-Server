import pool from "../db/pool.js";

function toPublicDrill(row) {
  return {
    id: row.id,
    name: row.name,
    unitKind: row.unit_kind,
    sets: row.default_sets,
    reps: row.default_reps,
    secondsPerSet: row.seconds_per_set,
    boosts: row.boosts,
  };
}

export async function listDrills() {
  const result = await pool.query(`
    SELECT
      drills.id,
      drills.name,
      drills.unit_kind,
      drills.default_sets,
      drills.default_reps,
      drills.seconds_per_set,
      COALESCE(
        jsonb_object_agg(attributes.code, drill_attribute_boosts.boost_value)
          FILTER (WHERE attributes.code IS NOT NULL),
        '{}'
      ) AS boosts
    FROM drills
    LEFT JOIN drill_attribute_boosts ON drill_attribute_boosts.drill_id = drills.id
    LEFT JOIN attributes ON attributes.id = drill_attribute_boosts.attribute_id
    GROUP BY drills.id
    ORDER BY drills.id
  `);
  return result.rows.map(toPublicDrill);
}
