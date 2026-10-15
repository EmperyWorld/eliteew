/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for pending-turn reload delay banner (plan 15 R03).
 *
 * Invariants:
 * - Banner applies only when pending, no streaming tokens, and elapsed ≥ threshold.
 *
 * Related:
 * - src/features/ewa/companionUx/useCompanionPendingReloadDelay.ts
 */

/** Milliseconds before showing “reply delayed” while pending without stream tokens. */
export const COMPANION_PENDING_RELOAD_DELAY_MS = 8_000;

export function shouldShowCompanionPendingReloadDelay(
	pending: boolean,
	streamingText: string,
	elapsedMs: number,
	thresholdMs = COMPANION_PENDING_RELOAD_DELAY_MS
): boolean {
	if (!pending) return false;
	if (streamingText.trim().length > 0) return false;
	return elapsedMs >= thresholdMs;
}
