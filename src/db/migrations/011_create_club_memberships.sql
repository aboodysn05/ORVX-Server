-- Which players are on which club's roster. A player has at most one active
-- membership; `active = false` rows are the release history. The squad cap
-- (16) is enforced in the service layer, not the schema.

CREATE TABLE club_memberships (
  id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position TEXT CHECK (position IS NULL OR position IN ('Attacker', 'Defender', 'Goalkeeper')),
  active BOOLEAN NOT NULL DEFAULT true,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER club_memberships_set_updated_at
BEFORE UPDATE ON club_memberships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX club_memberships_one_active_per_player
  ON club_memberships (player_id) WHERE active;

CREATE INDEX idx_club_memberships_club_active
  ON club_memberships (club_id) WHERE active;
