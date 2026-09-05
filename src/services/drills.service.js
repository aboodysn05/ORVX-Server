import pool from "../db/pool.js";
import { estimateMinutes } from "../utils/drillTiming.js";

function toPublicDrill(row) {
  return {
    id: row.id,
    name: row.name,
    unitKind: row.unit_kind,
    sets: row.default_sets,
    reps: row.default_reps,
    secondsPerSet: row.seconds_per_set,
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

export async function listDrills() {
  const result = await pool.query(`
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
    GROUP BY drills.id
    ORDER BY drills.id
  `);
  return result.rows.map(toPublicDrill);
}
