/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock audience picker search filters.
 */
import { describe, expect, it } from 'vitest';
import {
	filterAudienceGroups,
	filterAudienceUsers,
} from '../SurveyAdminAudiencePicker';

describe('SurveyAdminAudiencePicker filters', () => {
	it('filters groups and users by query', () => {
		expect(
			filterAudienceGroups(
				[
					{
						id: '1',
						name: 'Beta testers',
						description: null,
						created_at: '',
						updated_at: '',
					},
					{
						id: '2',
						name: 'Staff',
						description: null,
						created_at: '',
						updated_at: '',
					},
				],
				'beta'
			)
		).toHaveLength(1);
		expect(
			filterAudienceUsers(
				[
					{
						id: 'u1',
						username: 'alice',
						email: 'alice@example.com',
						role: 'user',
						ugs_credits: 0,
						ew_balance: 0,
						app_access_group_id: null,
						app_access_group_name: null,
					},
				],
				'example'
			)
		).toHaveLength(1);
	});
});
