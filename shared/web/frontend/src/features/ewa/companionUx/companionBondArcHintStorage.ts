/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * One-time bond-arc onboarding tooltip dismissal per companion principal (localStorage).
 *
 * Invariants:
 * - UI-only preference; bond arc tooltip uses existing ``ewaCompanion.bondArcHint`` copy.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionPresenceCompactBar.tsx
 */

const KEY_PREFIX = 'eliteew.companion.bondArcOnboarding.v1:';

export function isBondArcOnboardingDismissed(principalId: string): boolean {
	if (typeof window === 'undefined' || !principalId.trim()) return false;
	try {
		return window.localStorage.getItem(`${KEY_PREFIX}${principalId}`) === '1';
	} catch {
		return false;
	}
}

export function dismissBondArcOnboarding(principalId: string): void {
	if (typeof window === 'undefined' || !principalId.trim()) return;
	try {
		window.localStorage.setItem(`${KEY_PREFIX}${principalId}`, '1');
	} catch {
		/* best-effort */
	}
}
