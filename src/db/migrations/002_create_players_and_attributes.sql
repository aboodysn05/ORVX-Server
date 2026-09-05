CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  position TEXT NOT NULL CHECK (position IN ('Attacker', 'Defender', 'Goalkeeper')),
  dominant_foot TEXT NOT NULL CHECK (dominant_foot IN ('Left', 'Right', 'Both')),
  height_cm INTEGER NOT NULL CHECK (height_cm BETWEEN 100 AND 230),
  weight_kg INTEGER NOT NULL CHECK (weight_kg BETWEEN 30 AND 150),
  overall INTEGER NOT NULL CHECK (overall BETWEEN 0 AND 100),
  tier TEXT NOT NULL CHECK (tier IN ('Bronze', 'Silver', 'Gold')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER players_set_updated_at
BEFORE UPDATE ON players
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Catalog of the 12 attributes the assessment wizard collects. `code` matches
-- the key the frontend already sends (see frontend/src/hooks/usePlayerAssessment.js
-- buildPayload) so the API can accept that payload's `attributes` object as-is.
CREATE TABLE attributes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  position_group TEXT NOT NULL CHECK (position_group IN ('outfield', 'goalkeeper')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO attributes (code, name, position_group) VALUES
  ('pace', 'Pace', 'outfield'),
  ('shooting', 'Shooting', 'outfield'),
  ('passing', 'Passing', 'outfield'),
  ('dribbling', 'Dribbling', 'outfield'),
  ('defending', 'Defending', 'outfield'),
  ('physical', 'Physical', 'outfield'),
  ('diving', 'Diving', 'goalkeeper'),
  ('handling', 'Handling', 'goalkeeper'),
  ('kicking', 'Kicking', 'goalkeeper'),
  ('reflexes', 'Reflexes', 'goalkeeper'),
  ('speed', 'Speed', 'goalkeeper'),
  ('positioning', 'Positioning', 'goalkeeper');

CREATE TABLE player_attributes (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  attribute_id INTEGER NOT NULL REFERENCES attributes(id) ON DELETE RESTRICT,
  value INTEGER NOT NULL CHECK (value BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, attribute_id)
);

CREATE TRIGGER player_attributes_set_updated_at
BEFORE UPDATE ON player_attributes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
