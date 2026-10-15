/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist companion UX onboarding v2 step dismissal per principal (localStorage).
 *
 * Invariants:
 * - Steps: tools, workflows, operations — stored as string array.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionUxOnboardingHints.tsx
 */

export type CompanionUxOnboardingStepId = 'tools' | 'workflows' | 'operations';

const KEY_PREFIX = 'eliteew.companion.uxOnboarding.v1:';

export function readDismissedUxOnboardingSteps(
	principalId: string
): CompanionUxOnboardingStepId[] {
	if (typeof window === 'undefined' || !principalId.trim()) return [];
	try {
		const raw = window.localStorage.getItem(`${KEY_PREFIX}${principalId}`);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		const allowed = new Set<CompanionUxOnboardingStepId>([
			'tools',
			'workflows',
			'operations',
		]);
		return parsed.filter(
			(row): row is CompanionUxOnboardingStepId =>
				typeof row === 'string' &&
				allowed.has(row as CompanionUxOnboardingStepId)
		);
	} catch {
		return [];
	}
}

export function dismissUxOnboardingStep(
	principalId: string,
	step: CompanionUxOnboardingStepId
): void {
	if (typeof window === 'undefined' || !principalId.trim()) return;
	const current = new Set(readDismissedUxOnboardingSteps(principalId));
	current.add(step);
	try {
		window.localStorage.setItem(
			`${KEY_PREFIX}${principalId}`,
			JSON.stringify([...current])
		);
	} catch {
		/* best-effort */
	}
}

export function dismissAllUxOnboarding(principalId: string): void {
	if (typeof window === 'undefined' || !principalId.trim()) return;
	try {
		window.localStorage.setItem(
			`${KEY_PREFIX}${principalId}`,
			JSON.stringify(['tools', 'workflows', 'operations'])
		);
	} catch {
		/* best-effort */
	}
}
