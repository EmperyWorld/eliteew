/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * **Canonical proactive observation pacing constants** shared by companion client ticks (debounce /
 * polling / idle thresholds). Imported by ``useEwaCompanionAnticipationTick`` — `amkaShellObservations.ts`
 * remains server observation **shape helpers** only; do not duplicate numbers there.
 *
 * Invariants:
 * - Values mirror server expectations documented in ``EWA-COMPANION-PROACTIVE-OBSERVER.md``.
 * Related:
 * - src/features/ewa/useEwaCompanionAnticipationTick.ts
 * - api/ewa_platform/gateways/routers/companion_chat.py (`POST …/companion-observation`)
 */
export const COMPANION_OBSERVATION_POLL_INTERVAL_MS = 10000;
export const COMPANION_OBSERVATION_MIN_GAP_MS = 8000;
export const COMPANION_OBSERVATION_IDLE_MS = 45000;
