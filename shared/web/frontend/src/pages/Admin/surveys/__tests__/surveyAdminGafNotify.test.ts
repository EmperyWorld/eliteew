/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock GAF notify body resolution for admin preview.
 */
import { describe, expect, it } from 'vitest';
import {
	buildDefaultSurveyGafNotifyBody,
	resolveSurveyGafNotifyBody,
} from '../surveyAdminGafNotify';

describe('resolveSurveyGafNotifyBody', () => {
	it('uses custom template when non-empty', () => {
		const result = resolveSurveyGafNotifyBody('Hello team', 'NPS pulse');
		expect(result).toEqual({ body: 'Hello team', usesDefault: false });
	});

	it('falls back to server default when template empty', () => {
		const result = resolveSurveyGafNotifyBody('  ', 'Q2 feedback');
		expect(result.usesDefault).toBe(true);
		expect(result.body).toBe(buildDefaultSurveyGafNotifyBody('Q2 feedback'));
	});
});
