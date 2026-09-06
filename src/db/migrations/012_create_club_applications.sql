-- A released free agent applies to one club at a time; the club's head coach
-- accepts (signing them) or declines. Signing a player elsewhere withdraws
-- their other pending applications (handled in the service).

CREATE TABLE club_applications (
  id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER club_applications_set_updated_at
BEFORE UPDATE ON club_applications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX club_applications_one_pending_per_player
  ON club_applications (player_id) WHERE status = 'pending';
