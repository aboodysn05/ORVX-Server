CREATE TABLE drills (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  unit_kind TEXT NOT NULL CHECK (unit_kind IN ('reps', 'secs')),
  default_sets INTEGER NOT NULL CHECK (default_sets > 0),
  default_reps INTEGER NOT NULL CHECK (default_reps > 0),
  seconds_per_set INTEGER NOT NULL CHECK (seconds_per_set > 0),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER drills_set_updated_at
BEFORE UPDATE ON drills
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Which attributes a drill boosts, and by how much. A drill can boost more
-- than one (e.g. Box-to-Box Sprint Drills boosts both physical and pace).
CREATE TABLE drill_attribute_boosts (
  id SERIAL PRIMARY KEY,
  drill_id INTEGER NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  attribute_id INTEGER NOT NULL REFERENCES attributes(id) ON DELETE RESTRICT,
  boost_value INTEGER NOT NULL CHECK (boost_value > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (drill_id, attribute_id)
);

-- Dummy catalog data, ported from the frontend's hardcoded session-builder
-- library (frontend/src/hooks/useSessionBuilder.js LIBRARY) so the wizard can
-- eventually fetch this from the API instead of a hardcoded array.
INSERT INTO drills (name, unit_kind, default_sets, default_reps, seconds_per_set) VALUES
  ('Cone Slalom Agility Weave', 'reps', 3, 5, 200),
  ('Tight-Space 1v1 Dribbling', 'reps', 4, 3, 225),
  ('Box-to-Box Sprint Drills', 'secs', 5, 30, 120),
  ('Wall-Pass Rebound Control', 'reps', 4, 12, 150),
  ('First-Touch Finishing Volley', 'reps', 3, 8, 200),
  ('Speed Ladder Quick Feet', 'secs', 4, 20, 90),
  ('Shielding & Shoulder Duels', 'reps', 3, 6, 180),
  ('Recovery Press & Tackle Angles', 'reps', 4, 6, 165),
  ('Long-Range Chip Accuracy', 'reps', 3, 10, 200),
  ('Cruyff Turn Repetition Set', 'reps', 4, 8, 135);

INSERT INTO drill_attribute_boosts (drill_id, attribute_id, boost_value)
SELECT drills.id, attributes.id, boosts.value
FROM (VALUES
  ('Cone Slalom Agility Weave', 'pace', 2),
  ('Tight-Space 1v1 Dribbling', 'dribbling', 2),
  ('Box-to-Box Sprint Drills', 'physical', 1),
  ('Box-to-Box Sprint Drills', 'pace', 1),
  ('Wall-Pass Rebound Control', 'passing', 2),
  ('First-Touch Finishing Volley', 'shooting', 2),
  ('Speed Ladder Quick Feet', 'pace', 1),
  ('Speed Ladder Quick Feet', 'dribbling', 1),
  ('Shielding & Shoulder Duels', 'physical', 2),
  ('Recovery Press & Tackle Angles', 'defending', 2),
  ('Long-Range Chip Accuracy', 'passing', 1),
  ('Long-Range Chip Accuracy', 'shooting', 1),
  ('Cruyff Turn Repetition Set', 'dribbling', 2)
) AS boosts(drill_name, attribute_code, value)
JOIN drills ON drills.name = boosts.drill_name
JOIN attributes ON attributes.code = boosts.attribute_code;
