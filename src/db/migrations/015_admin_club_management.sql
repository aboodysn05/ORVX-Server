-- Audit timestamp for club archiving. Archiving also frees the club's slot
-- (set to NULL in the service) so a replacement club can be provisioned into
-- it; restoring re-claims a free slot.

ALTER TABLE clubs ADD COLUMN archived_at TIMESTAMPTZ;
