-- Align table names with the domain language in CLAUDE.md and the
-- postgres-schema skill: a submitted training session is a `drill_submission`,
-- a scheduled/played tie is a `match`. Pure renames — no data or behaviour
-- change. Auto-named check constraints, primary keys and sequences keep their
-- old names (cosmetic only, invisible to application code).

-- training_sessions -> drill_submissions --------------------------------------
ALTER TABLE training_sessions RENAME TO drill_submissions;
ALTER INDEX training_sessions_one_in_flight_per_player
  RENAME TO drill_submissions_one_in_flight_per_player;
ALTER TRIGGER training_sessions_set_updated_at ON drill_submissions
  RENAME TO drill_submissions_set_updated_at;

-- session_drills -> drill_submission_drills ----------------------------------
ALTER TABLE session_drills RENAME TO drill_submission_drills;
ALTER TABLE drill_submission_drills RENAME COLUMN session_id TO drill_submission_id;
ALTER TABLE drill_submission_drills
  RENAME CONSTRAINT session_drills_session_id_position_key
  TO drill_submission_drills_submission_id_position_key;

-- fixtures -> matches ------------------------------------------------------------
ALTER TABLE fixtures RENAME TO matches;
ALTER INDEX idx_fixtures_competition_id RENAME TO idx_matches_competition_id;
ALTER TRIGGER fixtures_set_updated_at ON matches
  RENAME TO matches_set_updated_at;
ALTER TABLE matches
  RENAME CONSTRAINT chk_fixtures_score_matches_status
  TO chk_matches_score_matches_status;
