/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock admin catalog meta derivation.
 */
import { describe, expect, it } from 'vitest';
import {
	filterAdminCatalogSurveys,
	summarizeAdminCatalog,
	surveyAdminCatalogMeta,
} from '../surveyAdminCatalogUtils';

describe('surveyAdminCatalogMeta', () => {
	it('prefers question_count over loaded questions length', () => {
		const meta = surveyAdminCatalogMeta({
			id: '1',
			title: 'T',
			description_user: '',
			description_admin: null,
			status: 'draft',
			audience_mode: 'groups_or_users',
			reward: { ugs_credits: 0, ew_balance: 0, web_search_coins: 0 },
			gaf_notify_body_template: null,
			closes_at: null,
			published_at: null,
			sort_order: 0,
			created_at: '',
			updated_at: '',
			access_group_ids: ['g1'],
			user_ids: ['u1', 'u2'],
			questions: [],
			question_count: 7,
			eligible_count: null,
			completed_count: 3,
		});
		expect(meta).toEqual({ questionCount: 7, audienceSize: 3 });
	});
});

describe('filterAdminCatalogSurveys', () => {
	it('filters by query and status', () => {
		const base = {
			id: '1',
			title: 'NPS Pulse',
			description_user: 'Quarterly check',
			description_admin: null,
			status: 'draft',
			audience_mode: 'groups_or_users',
			reward: { ugs_credits: 0, ew_balance: 0, web_search_coins: 0 },
			gaf_notify_body_template: null,
			closes_at: null,
			published_at: null,
			sort_order: 0,
			created_at: '',
			updated_at: '',
			access_group_ids: [],
			user_ids: [],
			questions: [],
			question_count: 1,
			eligible_count: null,
			completed_count: 0,
		};
		const items = [
			base,
			{ ...base, id: '2', title: 'Other', status: 'published' },
		];
		expect(
			filterAdminCatalogSurveys(items, { query: 'nps', statusFilter: '' })
		).toHaveLength(1);
		expect(summarizeAdminCatalog(items).published).toBe(1);
	});
});
