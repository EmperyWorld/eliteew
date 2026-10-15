import { describe, expect, it } from 'vitest';
import {
	createEmptyPoemmaOnboardingForm,
	isPoemmaStrategyEmpty,
	poemmaOnboardingProgressLabel,
	resolvePoemmaHomeRoute,
	validatePoemmaOnboardingStep,
} from '../poemmaOnboardingSteps';

describe('poemmaOnboardingSteps', () => {
	it('shows progress label for each step', () => {
		expect(poemmaOnboardingProgressLabel(1)).toBe('Шаг 1 из 6');
		expect(poemmaOnboardingProgressLabel(6)).toBe('Шаг 6 из 6');
	});

	it('validates vision and mission on step 2', () => {
		const form = createEmptyPoemmaOnboardingForm();
		expect(validatePoemmaOnboardingStep(2, form)).toBe('Заполните видение');
		form.vision = 'Видение';
		expect(validatePoemmaOnboardingStep(2, form)).toBe('Заполните миссию');
		form.mission = 'Миссия';
		expect(validatePoemmaOnboardingStep(2, form)).toBeNull();
	});

	it('requires segment shares to total 100 on step 6', () => {
		const form = createEmptyPoemmaOnboardingForm();
		form.segments[0].sharePercent = 25;
		form.segments[1].sharePercent = 25;
		form.segments[2].sharePercent = 25;
		form.segments[3].sharePercent = 20;
		const message = validatePoemmaOnboardingStep(6, form);
		expect(message).toMatch(/95%/);
	});

	it('detects empty strategy for P-104 redirect', () => {
		expect(isPoemmaStrategyEmpty(null)).toBe(true);
		expect(
			isPoemmaStrategyEmpty({
				orgId: 'org-1',
				vision: '',
				mission: 'Миссия',
				values: [],
				utp: '',
				updatedAt: '',
				updatedBy: 'u1',
			})
		).toBe(true);
		expect(
			isPoemmaStrategyEmpty({
				orgId: 'org-1',
				vision: 'Видение',
				mission: 'Миссия',
				values: [],
				utp: '',
				updatedAt: '',
				updatedBy: 'u1',
			})
		).toBe(false);
	});

	it('resolves home route from repository strategy', async () => {
		const emptyRepo = {
			getStrategy: async () => null,
		};
		expect(await resolvePoemmaHomeRoute(emptyRepo)).toBe('/onboarding');

		const filledRepo = {
			getStrategy: async () => ({
				orgId: 'org-1',
				vision: 'Видение',
				mission: 'Миссия',
				values: ['Правда'],
				utp: 'УТП',
				updatedAt: '',
				updatedBy: 'u1',
			}),
		};
		expect(await resolvePoemmaHomeRoute(filledRepo)).toBe('/');
	});
});
