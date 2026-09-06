-- Goalscorers for a recorded match. Insert/delete only (no updated_at) — a
-- result edit replaces the whole set. `scorer_name` is a plain string, same
-- simplification as reviewer_name; there's no players<->match link yet.

CREATE TABLE match_goals (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  scorer_name TEXT NOT NULL,
  minute INTEGER CHECK (minute IS NULL OR minute BETWEEN 1 AND 130),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_goals_match_id ON match_goals (match_id);
