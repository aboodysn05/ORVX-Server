-- One row per training session, moving through active -> completed -> submitted
-- (mirrors the frontend's session lifecycle in trainingSession.js).
CREATE TABLE training_sessions (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  focus TEXT,
  total_time_minutes INTEGER NOT NULL DEFAULT 0 CHECK (total_time_minutes >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'submitted')),
  -- Video proof + reviewer routing, filled in on submit. `reviewer_name` is a
  -- plain string for now, same as the frontend's hardcoded coach list — swap
  -- for a real coach_id FK once a coach directory exists.
  video_url TEXT,
  notes TEXT,
  reviewer_name TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER training_sessions_set_updated_at
BEFORE UPDATE ON training_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Only one in-flight (not yet submitted) session per player at a time —
-- matches the frontend's single active-session slot.
CREATE UNIQUE INDEX training_sessions_one_in_flight_per_player
  ON training_sessions (player_id)
  WHERE status IN ('active', 'completed');

-- Snapshot of each drill in the session (name/boosts copied from `drills` at
-- build time) so a later edit to the catalog doesn't rewrite history, plus the
-- player's tuned sets/reps and per-set completion checklist.
CREATE TABLE session_drills (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  drill_id INTEGER REFERENCES drills(id) ON DELETE SET NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  name TEXT NOT NULL,
  unit_kind TEXT NOT NULL CHECK (unit_kind IN ('reps', 'secs')),
  sets INTEGER NOT NULL CHECK (sets > 0),
  reps INTEGER NOT NULL CHECK (reps > 0),
  boosts JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, position)
);
