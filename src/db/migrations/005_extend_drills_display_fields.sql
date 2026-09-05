-- The public Drills Explorer page shows richer copy than the session-builder
-- catalog needed (level/coach/rating/instructions). Extending the same
-- `drills` table (rather than a second table) keeps one drill = one row,
-- whether it's being browsed publicly or added to a training session.
ALTER TABLE drills
  ADD COLUMN level TEXT NOT NULL DEFAULT 'Intermediate' CHECK (level IN ('Beginner', 'Intermediate', 'Elite')),
  ADD COLUMN focus_label TEXT NOT NULL DEFAULT '',
  ADD COLUMN coach_display_name TEXT NOT NULL DEFAULT 'Coach Marcus',
  ADD COLUMN completions_count INTEGER NOT NULL DEFAULT 0 CHECK (completions_count >= 0),
  ADD COLUMN rating NUMERIC(2, 1) NOT NULL DEFAULT 4.5 CHECK (rating BETWEEN 0 AND 5),
  ADD COLUMN setup_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN execution_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN rule_text TEXT NOT NULL DEFAULT '';

UPDATE drills SET
  level = 'Intermediate', focus_label = 'Agility & Feet', coach_display_name = 'Coach Marcus',
  completions_count = 342, rating = 4.8,
  setup_text = 'Eight cones, one metre apart, in a straight line. Ball at the first cone, phone on a tripod square to the run.',
  execution_text = 'Weave the full line using both feet, turn at the end and return. Six passes without touching a cone.',
  rule_text = 'The full run must stay in frame from first touch to final turn. Cuts void the submission.'
WHERE name = 'Cone Slalom Agility Weave';

UPDATE drills SET
  level = 'Intermediate', focus_label = 'Close Control', coach_display_name = 'Coach Elena',
  completions_count = 210, rating = 4.6,
  setup_text = 'A 3x3 metre grid marked with cones, one ball, a passive defender inside the grid.',
  execution_text = 'Keep the ball under control against the defender for 30-second bursts, resetting on a loss of possession.',
  rule_text = 'The full grid must stay in frame. Log every burst, including resets.'
WHERE name = 'Tight-Space 1v1 Dribbling';

UPDATE drills SET
  level = 'Elite', focus_label = 'Endurance & Pace', coach_display_name = 'Coach Idris',
  completions_count = 289, rating = 4.7,
  setup_text = 'Two markers 40 metres apart on grass or track, camera positioned side-on to capture the full distance.',
  execution_text = 'Sprint box-to-box at match intensity, jogging back for recovery between reps.',
  rule_text = 'Both markers must be visible throughout. No cutting the distance short.'
WHERE name = 'Box-to-Box Sprint Drills';

UPDATE drills SET
  level = 'Beginner', focus_label = 'Short Passing', coach_display_name = 'Coach Marcus',
  completions_count = 288, rating = 4.6,
  setup_text = 'Chalk a 60cm target on a wall, stand at 8, 12 and 16 metres.',
  execution_text = 'Ten passes from each distance, alternating feet, first touch only.',
  rule_text = 'Target and player both in frame; the count is audible or on screen.'
WHERE name = 'Wall-Pass Rebound Control';

UPDATE drills SET
  level = 'Intermediate', focus_label = 'Finishing', coach_display_name = 'Coach Idris',
  completions_count = 402, rating = 4.7,
  setup_text = 'Goal, six balls spread across the edge of the box, one server.',
  execution_text = 'One-touch finishes from each position, alternating near and far post calls.',
  rule_text = 'Goal frame visible on every strike. Ten seconds maximum between attempts.'
WHERE name = 'First-Touch Finishing Volley';

UPDATE drills SET
  level = 'Beginner', focus_label = 'Footwork Speed', coach_display_name = 'Coach Elena',
  completions_count = 198, rating = 4.5,
  setup_text = 'A standard agility ladder laid flat on grass or turf, camera side-on.',
  execution_text = 'Run the full ladder pattern at maximum tempo, resetting to the start for each rep.',
  rule_text = 'Full ladder must stay in frame. Missed rungs restart the rep.'
WHERE name = 'Speed Ladder Quick Feet';

UPDATE drills SET
  level = 'Intermediate', focus_label = 'Ball Protection', coach_display_name = 'Coach Idris',
  completions_count = 176, rating = 4.4,
  setup_text = 'A five-metre channel, one attacker with the ball, one defender applying pressure from behind.',
  execution_text = 'Shield the ball under contact for the full duration of each rep, rotating shoulders to keep the defender out.',
  rule_text = 'Contact must stay within the channel. Log a rep only if the ball is retained for its full duration.'
WHERE name = 'Shielding & Shoulder Duels';

UPDATE drills SET
  level = 'Intermediate', focus_label = 'Positioning & Tackling', coach_display_name = 'Coach Elena',
  completions_count = 194, rating = 4.5,
  setup_text = 'A ten metre channel with two cones as the gate, one attacker, one ball.',
  execution_text = 'Jockey the attacker across the channel, force the weak side, win the ball inside the gate.',
  rule_text = 'Full channel in frame. Six repetitions, alternating sides.'
WHERE name = 'Recovery Press & Tackle Angles';

UPDATE drills SET
  level = 'Elite', focus_label = 'Long Passing', coach_display_name = 'Coach Marcus',
  completions_count = 231, rating = 4.6,
  setup_text = 'A 1-metre target zone at 25 and 35 metres, ball on the ground at the start point.',
  execution_text = 'Chip the target zone from each distance, alternating feet, five attempts per distance.',
  rule_text = 'Target zone and strike point both in frame for every attempt.'
WHERE name = 'Long-Range Chip Accuracy';

UPDATE drills SET
  level = 'Beginner', focus_label = 'Turning & Feints', coach_display_name = 'Coach Elena',
  completions_count = 205, rating = 4.5,
  setup_text = 'Open space with one cone marking the turn point, camera side-on to the approach and exit.',
  execution_text = 'Approach at jogging pace, execute the turn at the cone, accelerate away on the new line.',
  rule_text = 'The full turn — approach, contact, exit — must be visible in one continuous take.'
WHERE name = 'Cruyff Turn Repetition Set';
