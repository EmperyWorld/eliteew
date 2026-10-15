/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import {
	buildSurveyUserLookup,
	resolveSurveyUserLabel,
} from '../surveyAdminUserLookup';

describe('surveyAdminUserLookup', () => {
	it('resolves username for export labels', () => {
		const lookup = buildSurveyUserLookup([
			{
				id: 'u-1',
				username: 'alice',
				email: 'a@example.com',
				role: 'user',
				ugs_credits: 0,
				ew_balance: 0,
				app_access_group_id: 'g1',
				app_access_group_name: 'G',
			},
		]);
		expect(resolveSurveyUserLabel(lookup, 'u-1')).toBe('alice');
		expect(resolveSurveyUserLabel(lookup, 'missing')).toBe('missing');
	});
});
