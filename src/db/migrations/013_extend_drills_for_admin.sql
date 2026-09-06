-- Fields the admin drill catalogue manages: a category, the position group the
-- drill suits, per-drill volume caps the session builder enforces, an active
-- flag (retire without deleting), and a demo-clip URL. Defaults keep the 10
-- seeded drills valid and match the ranges sessions.service used to hard-code
-- (1..20 sets, 1..300 reps).

ALTER TABLE drills
  ADD COLUMN category TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN position_group TEXT
    CHECK (position_group IS NULL OR position_group IN ('outfield', 'goalkeeper', 'all')),
  ADD COLUMN min_sets INTEGER NOT NULL DEFAULT 1 CHECK (min_sets > 0),
  ADD COLUMN max_sets INTEGER NOT NULL DEFAULT 20 CHECK (max_sets > 0),
  ADD COLUMN min_reps INTEGER NOT NULL DEFAULT 1 CHECK (min_reps > 0),
  ADD COLUMN max_reps INTEGER NOT NULL DEFAULT 300 CHECK (max_reps > 0),
  ADD COLUMN active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN demo_video_url TEXT;

ALTER TABLE drills ADD CONSTRAINT chk_drills_set_bounds CHECK (max_sets >= min_sets);
ALTER TABLE drills ADD CONSTRAINT chk_drills_rep_bounds CHECK (max_reps >= min_reps);
