/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock completion rate formatting for admin results KPI.
 */
import { describe, expect, it } from 'vitest';
import { formatSurveyCompletionRate } from '../surveyAdminResultsFormat';

describe('formatSurveyCompletionRate', () => {
	it('formats fractional rate as whole percent', () => {
		expect(formatSurveyCompletionRate(0.425)).toBe('43%');
		expect(formatSurveyCompletionRate(1)).toBe('100%');
	});

	it('returns 0% for empty or invalid input', () => {
		expect(formatSurveyCompletionRate(0)).toBe('0%');
		expect(formatSurveyCompletionRate(Number.NaN)).toBe('0%');
	});
});
