-- The review workflow: a reviewer (Platform Evaluator or admin, and from
-- Phase 4 a club coach) approves or rejects a submitted drill submission.
-- Approval credits the submission's aggregated drill boosts to the player's
-- attributes and recomputes overall/tier. Until now `review_status` (added in
-- 004) was never written by any code path.

ALTER TABLE drill_submissions
  ADD COLUMN review_feedback TEXT,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
