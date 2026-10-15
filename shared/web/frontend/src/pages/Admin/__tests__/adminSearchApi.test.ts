/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for adminSearchApi URL builders and re-exports.
 */

import { describe, expect, it } from 'vitest';
import { isSearchAdminTab } from '../search/adminSearchUrl';
import { buildSearchConfigPatchBody } from '../adminSearchApi';

describe('adminSearchUrl', () => {
	it('recognizes valid search admin tabs', () => {
		expect(isSearchAdminTab('test')).toBe(true);
		expect(isSearchAdminTab('stats')).toBe(true);
		expect(isSearchAdminTab('invalid')).toBe(false);
	});
});

describe('adminSearchApi re-exports', () => {
	it('buildSearchConfigPatchBody still works via adminSearchApi', () => {
		const base = {
			provider: 'yandex' as const,
			yandex_search_type: 'auto',
			yandex_search_l10n: 'auto',
			yandex_search_region: '225',
			yandex_groups_on_page: 5,
			cache_enabled: true,
			cache_ttl_sec: 300,
			cache_empty_ttl_sec: 60,
			quota_enforced: true,
			monthly_free_default: 50,
			default_limit: 8,
			surfaces: {
				desktop: true,
				ewa: true,
				marketing: true,
				imperorg: true,
				ugs: true,
			},
		};
		expect(
			buildSearchConfigPatchBody({
				base,
				draft: { ...base, cache_enabled: false },
				secrets: {
					yandexApiKeyInput: '',
					yandexFolderIdInput: '',
					clearYandexApiKey: false,
					clearYandexFolderId: false,
				},
			})
		).toEqual({ settings: { cache_enabled: false } });
	});
});
