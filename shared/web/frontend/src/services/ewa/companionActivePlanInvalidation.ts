/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cross-surface invalidation when the active companion plan changes (chat → widgets).
 *
 * Invariants:
 * - Best-effort broadcast only; subscribers refetch from API (no payload trust).
 *
 * Related:
 * - features/ewa/companionUx/useCompanionLeftRailController.ts
 * - pages/Desktop/hooks/useDesktopAssistantPlanProjection.ts
 */

const EWA_COMPANION_ACTIVE_PLAN_INVALIDATED_EVENT =
	'ewa-companion-active-plan-invalidated';

type Listener = () => void;

export function dispatchCompanionActivePlanInvalidated(): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new Event(EWA_COMPANION_ACTIVE_PLAN_INVALIDATED_EVENT));
}

export function subscribeCompanionActivePlanInvalidated(
	listener: Listener
): () => void {
	if (typeof window === 'undefined') return () => {};
	window.addEventListener(
		EWA_COMPANION_ACTIVE_PLAN_INVALIDATED_EVENT,
		listener
	);
	return () => {
		window.removeEventListener(
			EWA_COMPANION_ACTIVE_PLAN_INVALIDATED_EVENT,
			listener
		);
	};
}
