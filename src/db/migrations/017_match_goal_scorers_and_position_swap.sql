-- Goalscorers are now picked from the two clubs' rosters instead of typed
-- free-hand, so a goal points at the player who scored it. scorer_name is kept
-- as a denormalised display value so a released/deleted player still reads
-- correctly on an old match sheet.
ALTER TABLE match_goals
  ADD COLUMN player_id INTEGER REFERENCES players(id) ON DELETE SET NULL;

CREATE INDEX idx_match_goals_player_id ON match_goals(player_id);

-- Changing a player's registered position is no longer destructive: both the
-- outfield and goalkeeper attribute rows can coexist on one player, and
-- players.position decides which six are active. Guarantee the upsert path a
-- unique target.
CREATE UNIQUE INDEX IF NOT EXISTS player_attributes_player_attribute_key
  ON player_attributes (player_id, attribute_id);
