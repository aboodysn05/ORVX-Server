// Shared by drills.service.js (catalog display) and sessions.service.js
// (total session time) so there's one formula for "how long does this drill
// take", not two copies that could drift — matches the frontend's original
// drillMinutes() in useSessionBuilder.js.
export function estimateMinutes(unitKind, sets, reps, secondsPerSet) {
  const seconds = unitKind === "secs" ? sets * (reps + 60) : sets * secondsPerSet;
  return Math.max(1, Math.round(seconds / 60));
}
