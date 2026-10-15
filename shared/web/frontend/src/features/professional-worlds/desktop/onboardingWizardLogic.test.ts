/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for onboarding wizard navigation and auto-complete rules.
 *
 * Related:
 * - onboardingWizardLogic.ts
 */

import { describe, expect, it } from 'vitest';

import {
	deriveAutoCompletableOnboardingSteps,
	extractOnboardingCompletedSteps,
	onboardingStepNavigateTarget,
} from './onboardingWizardLogic';

describe('onboardingWizardLogic', () => {
	it('maps known step keys to workspace views', () => {
		expect(onboardingStepNavigateTarget('profile')).toBe('profile');
		expect(onboardingStepNavigateTarget('first-object')).toBe('properties');
		expect(onboardingStepNavigateTarget('first-artifact')).toBe('artifacts');
		expect(onboardingStepNavigateTarget('unknown')).toBeNull();
	});

	it('extracts completed step ids from activation onboarding', () => {
		expect([
			...extractOnboardingCompletedSteps({ completed_steps: ['profile'] }),
		]).toEqual(['profile']);
		expect([
			...extractOnboardingCompletedSteps({ completedSteps: ['first-object'] }),
		]).toEqual(['first-object']);
	});

	it('derives auto-completable steps from snapshot signals', () => {
		const completed = new Set(['profile']);
		expect(
			deriveAutoCompletableOnboardingSteps({
				profileReady: true,
				propertiesCount: 2,
				artifactsCount: 1,
				completedSteps: completed,
			})
		).toEqual(['first-object', 'first-artifact']);
	});
});
