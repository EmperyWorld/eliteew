/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime onboarding step keys: navigation targets and auto-complete rules for the quick-start wizard.
 *
 * Invariants:
 * - Step completion is persisted in vertical activation onboarding JSON only.
 * - Auto-complete keys align with default pack steps (`profile`, `first-object`, `first-artifact`).
 *
 * Related:
 * - RuntimeOnboardingWizard.tsx
 * - ProfessionalWorldsApp.tsx
 */

import type { ProfessionalWorldsActiveView } from './ProfessionalWorldsWorkspaceContext';

export const ONBOARDING_AUTO_COMPLETE_STEP_KEYS = [
	'profile',
	'first-object',
	'first-artifact',
] as const;

export type OnboardingAutoCompleteStepKey =
	(typeof ONBOARDING_AUTO_COMPLETE_STEP_KEYS)[number];

const STEP_NAV_TARGETS: Partial<
	Record<OnboardingAutoCompleteStepKey, ProfessionalWorldsActiveView>
> = {
	profile: 'profile',
	'first-object': 'properties',
	'first-artifact': 'artifacts',
};

export function extractOnboardingCompletedSteps(
	onboarding: Record<string, unknown> | null | undefined
): Set<string> {
	const raw = onboarding?.completed_steps ?? onboarding?.completedSteps;
	return new Set(
		Array.isArray(raw)
			? raw.filter((item): item is string => typeof item === 'string')
			: []
	);
}

export function onboardingStepNavigateTarget(
	stepKey: string
): ProfessionalWorldsActiveView | null {
	return STEP_NAV_TARGETS[stepKey as OnboardingAutoCompleteStepKey] ?? null;
}

export function deriveAutoCompletableOnboardingSteps(input: {
	profileReady: boolean;
	propertiesCount: number;
	artifactsCount: number;
	completedSteps: Set<string>;
}): OnboardingAutoCompleteStepKey[] {
	const next: OnboardingAutoCompleteStepKey[] = [];
	if (input.profileReady && !input.completedSteps.has('profile')) {
		next.push('profile');
	}
	if (input.propertiesCount > 0 && !input.completedSteps.has('first-object')) {
		next.push('first-object');
	}
	if (input.artifactsCount > 0 && !input.completedSteps.has('first-artifact')) {
		next.push('first-artifact');
	}
	return next;
}

/** True when all default quick-start step keys are marked complete. */
export function isOnboardingWizardComplete(
	onboarding: Record<string, unknown> | null | undefined
): boolean {
	const completed = extractOnboardingCompletedSteps(onboarding);
	return ONBOARDING_AUTO_COMPLETE_STEP_KEYS.every((key) => completed.has(key));
}
