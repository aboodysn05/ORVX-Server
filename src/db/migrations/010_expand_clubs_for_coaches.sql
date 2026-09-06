-- Clubs gain the fields the admin console manages: which of the 8 official
-- slots they occupy, their division, their head coach, and whether they've
-- been archived. `updated_at` + trigger since clubs are now mutated.

ALTER TABLE clubs
  ADD COLUMN slot INTEGER UNIQUE CHECK (slot BETWEEN 1 AND 8),
  ADD COLUMN division TEXT,
  ADD COLUMN head_coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
  ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER clubs_set_updated_at
BEFORE UPDATE ON clubs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Assign the 8 seeded clubs to slots 1..8 by creation order.
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM clubs
)
UPDATE clubs SET slot = ranked.rn
FROM ranked
WHERE clubs.id = ranked.id;
