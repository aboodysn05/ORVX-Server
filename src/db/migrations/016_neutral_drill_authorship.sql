-- The drill display fields (migration 005) shipped with demo authorship /
-- social-proof values ("Coach Marcus", completion counts, ratings). New drills
-- created by an admin have no author, so drop the demo default and blank the
-- social-proof counters on the existing catalogue. The instructional text
-- (setup / execution / rule) is real content and is left as-is.

ALTER TABLE drills ALTER COLUMN coach_display_name SET DEFAULT NULL;
ALTER TABLE drills ALTER COLUMN coach_display_name DROP NOT NULL;
ALTER TABLE drills ALTER COLUMN completions_count SET DEFAULT 0;
ALTER TABLE drills ALTER COLUMN rating SET DEFAULT 0;

UPDATE drills
SET coach_display_name = NULL,
    completions_count = 0,
    rating = 0;
