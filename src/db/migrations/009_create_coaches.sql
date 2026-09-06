-- Coach identity + the onboarding queue. A `coaches` row is a coach user's
-- profile (created on application approval, or seeded for the Platform
-- Evaluator). `coach_applications` is the club-management request an admin
-- approves or declines.

CREATE TABLE coaches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  years_experience INTEGER NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
  license_number TEXT,
  bio TEXT,
  credential_doc_url TEXT,
  avatar_url TEXT,
  is_platform_evaluator BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER coaches_set_updated_at
BEFORE UPDATE ON coaches
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE coach_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  years_experience INTEGER NOT NULL CHECK (years_experience >= 0),
  license_number TEXT,
  club_name TEXT NOT NULL,
  squad_capacity INTEGER NOT NULL DEFAULT 16 CHECK (squad_capacity BETWEEN 1 AND 16),
  credential_doc_url TEXT,
  club_logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  review_note TEXT,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER coach_applications_set_updated_at
BEFORE UPDATE ON coach_applications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- At most one open request per coach.
CREATE UNIQUE INDEX coach_applications_one_pending_per_user
  ON coach_applications (user_id) WHERE status = 'pending';

-- A submission approved by a club coach carries that coach's id; a baseline
-- submission awaiting the Platform Evaluator leaves this NULL.
ALTER TABLE drill_submissions
  ADD COLUMN reviewer_coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL;
