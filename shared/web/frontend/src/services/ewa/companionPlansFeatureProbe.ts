/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Session-scoped probe cache for companion plans feature availability — avoids repeat
 * `/companion-plans/active` calls after a disabled/opaque 404 in the same SPA session.
 *
 * Invariants:
 * - Module state only; not persisted across full page reloads.
 *
 * Related:
 * - ewaCompanionPlansApi.ts
 * - useCompanionLeftRailController.ts
 */

export type CompanionPlansFeatureProbeState =
	| 'unknown'
	| 'disabled'
	| 'enabled';

let companionPlansFeatureProbeState: CompanionPlansFeatureProbeState =
	'unknown';

export function readCompanionPlansFeatureProbeState(): CompanionPlansFeatureProbeState {
	return companionPlansFeatureProbeState;
}

export function cacheCompanionPlansFeatureProbeState(
	state: Exclude<CompanionPlansFeatureProbeState, 'unknown'>
): void {
	companionPlansFeatureProbeState = state;
}

/** Test-only reset. */
export function resetCompanionPlansFeatureProbeStateForTests(): void {
	companionPlansFeatureProbeState = 'unknown';
}
