CREATE TABLE clubs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  crest_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE competitions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('league', 'knockout')),
  season TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per match. `round_label` carries whatever grouping makes sense for
-- the competition's type ('Matchday 3' for a league, 'Quarter-Finals' for a
-- knockout); `leg` is only meaningful for two-legged knockout ties.
-- Standings are never stored — they're always computed from played fixtures
-- (see competitions.service.js), same principle as never storing a player's
-- "approved sessions" count.
CREATE TABLE fixtures (
  id SERIAL PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  round_label TEXT,
  leg INTEGER CHECK (leg IN (1, 2)),
  home_club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  away_club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE CHECK (away_club_id != home_club_id),
  home_score INTEGER CHECK (home_score >= 0),
  away_score INTEGER CHECK (away_score >= 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'played')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fixtures_score_matches_status CHECK (
    (status = 'played' AND home_score IS NOT NULL AND away_score IS NOT NULL) OR
    (status = 'scheduled' AND home_score IS NULL AND away_score IS NULL)
  )
);

CREATE TRIGGER fixtures_set_updated_at
BEFORE UPDATE ON fixtures
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_fixtures_competition_id ON fixtures(competition_id);

-- Seed: 8 clubs -------------------------------------------------------------
INSERT INTO clubs (name, crest_code) VALUES
  ('Northgate FC', 'NGF'),
  ('Riverside United', 'RIV'),
  ('Eastside Rangers', 'ESR'),
  ('Harbour Athletic', 'HAR'),
  ('Kingsway Town', 'KIN'),
  ('Meadow Park FC', 'MPF'),
  ('Central Wanderers', 'CWN'),
  ('Lakeside Rovers', 'LKR');

-- Seed: league competition, a full single round-robin (7 matchdays, 28
-- matches, all played) plus 4 upcoming reverse fixtures for "Matchday 8" so
-- the fixtures list has both finished and upcoming entries.
INSERT INTO competitions (name, type, season) VALUES
  ('Premier Development League', 'league', '2025/26');

INSERT INTO fixtures (competition_id, round_label, home_club_id, away_club_id, home_score, away_score, status, scheduled_at)
SELECT c.id, f.round_label, h.id, a.id, f.home_score, f.away_score, f.status, now() + f.sched_offset
FROM competitions c,
LATERAL (VALUES
  ('Matchday 1', 'Northgate FC',       'Lakeside Rovers',    4, 1, 'played',    interval '-10 weeks'),
  ('Matchday 1', 'Riverside United',   'Central Wanderers',  2, 0, 'played',    interval '-10 weeks'),
  ('Matchday 1', 'Eastside Rangers',   'Meadow Park FC',     3, 1, 'played',    interval '-10 weeks'),
  ('Matchday 1', 'Harbour Athletic',   'Kingsway Town',      1, 1, 'played',    interval '-10 weeks'),

  ('Matchday 2', 'Northgate FC',       'Central Wanderers',  3, 0, 'played',    interval '-9 weeks'),
  ('Matchday 2', 'Lakeside Rovers',    'Meadow Park FC',     0, 2, 'played',    interval '-9 weeks'),
  ('Matchday 2', 'Riverside United',   'Kingsway Town',      2, 1, 'played',    interval '-9 weeks'),
  ('Matchday 2', 'Eastside Rangers',   'Harbour Athletic',   1, 1, 'played',    interval '-9 weeks'),

  ('Matchday 3', 'Northgate FC',       'Meadow Park FC',     2, 1, 'played',    interval '-8 weeks'),
  ('Matchday 3', 'Central Wanderers',  'Kingsway Town',      1, 2, 'played',    interval '-8 weeks'),
  ('Matchday 3', 'Lakeside Rovers',    'Harbour Athletic',   0, 3, 'played',    interval '-8 weeks'),
  ('Matchday 3', 'Riverside United',   'Eastside Rangers',   2, 0, 'played',    interval '-8 weeks'),

  ('Matchday 4', 'Northgate FC',       'Kingsway Town',      3, 1, 'played',    interval '-7 weeks'),
  ('Matchday 4', 'Meadow Park FC',     'Harbour Athletic',   1, 2, 'played',    interval '-7 weeks'),
  ('Matchday 4', 'Central Wanderers',  'Eastside Rangers',   0, 2, 'played',    interval '-7 weeks'),
  ('Matchday 4', 'Lakeside Rovers',    'Riverside United',   1, 4, 'played',    interval '-7 weeks'),

  ('Matchday 5', 'Northgate FC',       'Harbour Athletic',   2, 0, 'played',    interval '-6 weeks'),
  ('Matchday 5', 'Kingsway Town',      'Eastside Rangers',   1, 1, 'played',    interval '-6 weeks'),
  ('Matchday 5', 'Meadow Park FC',     'Riverside United',   0, 3, 'played',    interval '-6 weeks'),
  ('Matchday 5', 'Central Wanderers',  'Lakeside Rovers',    2, 1, 'played',    interval '-6 weeks'),

  ('Matchday 6', 'Northgate FC',       'Eastside Rangers',   1, 1, 'played',    interval '-5 weeks'),
  ('Matchday 6', 'Harbour Athletic',   'Riverside United',   0, 1, 'played',    interval '-5 weeks'),
  ('Matchday 6', 'Kingsway Town',      'Lakeside Rovers',    3, 0, 'played',    interval '-5 weeks'),
  ('Matchday 6', 'Meadow Park FC',     'Central Wanderers',  1, 2, 'played',    interval '-5 weeks'),

  ('Matchday 7', 'Northgate FC',       'Riverside United',   2, 1, 'played',    interval '-4 weeks'),
  ('Matchday 7', 'Eastside Rangers',   'Lakeside Rovers',    3, 0, 'played',    interval '-4 weeks'),
  ('Matchday 7', 'Harbour Athletic',   'Central Wanderers',  2, 2, 'played',    interval '-4 weeks'),
  ('Matchday 7', 'Kingsway Town',      'Meadow Park FC',     1, 0, 'played',    interval '-4 weeks'),

  ('Matchday 8', 'Lakeside Rovers',    'Northgate FC',       NULL, NULL, 'scheduled', interval '1 week'),
  ('Matchday 8', 'Central Wanderers',  'Riverside United',   NULL, NULL, 'scheduled', interval '1 week'),
  ('Matchday 8', 'Meadow Park FC',     'Eastside Rangers',   NULL, NULL, 'scheduled', interval '1 week'),
  ('Matchday 8', 'Kingsway Town',      'Harbour Athletic',   NULL, NULL, 'scheduled', interval '1 week')
) AS f(round_label, home_name, away_name, home_score, away_score, status, sched_offset)
JOIN clubs h ON h.name = f.home_name
JOIN clubs a ON a.name = f.away_name
WHERE c.name = 'Premier Development League';

-- Seed: knockout cup — quarter-finals played, semi-finals in progress
-- (leg 1 played, leg 2 upcoming), final not seeded yet (nothing to show
-- until the semis are decided — the frontend renders that stage as TBD).
INSERT INTO competitions (name, type, season) VALUES
  ('OVRX Cup', 'knockout', '2025/26');

INSERT INTO fixtures (competition_id, round_label, leg, home_club_id, away_club_id, home_score, away_score, status, scheduled_at)
SELECT c.id, f.round_label, f.leg, h.id, a.id, f.home_score, f.away_score, f.status, now() + f.sched_offset
FROM competitions c,
LATERAL (VALUES
  ('Quarter-Finals', 1, 'Northgate FC',     'Lakeside Rovers',   3, 0, 'played', interval '-3 weeks'),
  ('Quarter-Finals', 2, 'Lakeside Rovers',  'Northgate FC',      1, 2, 'played', interval '-2 weeks'),
  ('Quarter-Finals', 1, 'Harbour Athletic', 'Eastside Rangers',  1, 1, 'played', interval '-3 weeks'),
  ('Quarter-Finals', 2, 'Eastside Rangers', 'Harbour Athletic',  2, 0, 'played', interval '-2 weeks'),
  ('Quarter-Finals', 1, 'Riverside United', 'Central Wanderers', 2, 0, 'played', interval '-3 weeks'),
  ('Quarter-Finals', 2, 'Central Wanderers','Riverside United',  1, 1, 'played', interval '-2 weeks'),
  ('Quarter-Finals', 1, 'Kingsway Town',    'Meadow Park FC',    0, 0, 'played', interval '-3 weeks'),
  ('Quarter-Finals', 2, 'Meadow Park FC',   'Kingsway Town',     2, 1, 'played', interval '-2 weeks'),

  ('Semi-Finals', 1, 'Northgate FC',      'Meadow Park FC',    2, 1, 'played',    interval '-1 week'),
  ('Semi-Finals', 2, 'Meadow Park FC',    'Northgate FC',      NULL, NULL, 'scheduled', interval '4 days'),
  ('Semi-Finals', 1, 'Eastside Rangers',  'Riverside United',  1, 1, 'played',    interval '-1 week'),
  ('Semi-Finals', 2, 'Riverside United',  'Eastside Rangers',  NULL, NULL, 'scheduled', interval '4 days')
) AS f(round_label, leg, home_name, away_name, home_score, away_score, status, sched_offset)
JOIN clubs h ON h.name = f.home_name
JOIN clubs a ON a.name = f.away_name
WHERE c.name = 'OVRX Cup';
