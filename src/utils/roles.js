// The "Platform Evaluator" (a.k.a. Coach #9) is a coach-role account that runs
// no club — it reviews new players' baseline submissions. It is provisioned
// manually (see scripts/seedEvaluator.js), never through the coach-application
// queue. Two signals mark one: the `coaches.is_platform_evaluator` boolean
// (authoritative once a coaches row exists) and, as a fallback for a bare user
// row, `users.organization === "Platform Evaluator"`. This helper is the single
// place that check lives.

export const PLATFORM_EVALUATOR_ORG = "Platform Evaluator";

export function isPlatformEvaluator(user) {
  if (!user) return false;
  if (user.isPlatformEvaluator === true) return true;
  return (
    user.role === "coach" &&
    (user.organization || "").trim().toLowerCase() === PLATFORM_EVALUATOR_ORG.toLowerCase()
  );
}
