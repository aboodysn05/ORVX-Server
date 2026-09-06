// Player rating primitives, shared by players.service.js (assessment) and
// review.service.js (crediting approved-drill XP). Kept in one place because
// the server always recomputes overall/tier itself rather than trusting client
// values — the thresholds must match frontend/src/hooks/usePlayerAssessment.js
// tierFor().

// Attribute `code`s, matching the attributes catalog table and what the
// assessment wizard sends.
export const OUTFIELD_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"];
export const GK_KEYS = ["diving", "handling", "kicking", "reflexes", "speed", "positioning"];

export function keysFor(position) {
  return position === "Goalkeeper" ? GK_KEYS : OUTFIELD_KEYS;
}

export function tierFor(overall) {
  if (overall >= 75) return "Gold";
  if (overall >= 65) return "Silver";
  return "Bronze";
}

// Average of the six position-relevant attribute values, rounded.
export function computeOverall(position, attrMap) {
  const keys = keysFor(position);
  return Math.round(keys.reduce((sum, key) => sum + (attrMap[key] ?? 0), 0) / keys.length);
}

// Attribute values live on a 0-100 scale.
export function clampAttr(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
