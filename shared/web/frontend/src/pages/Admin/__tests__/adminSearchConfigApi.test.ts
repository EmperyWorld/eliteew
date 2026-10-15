/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Admin Search Config payload builders and secret action mapping.
 *
 * Related:
 * - `pages/Admin/adminSearchConfigApi.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	buildSearchConfigPatchBody,
	buildSearchSecretsPatch,
	buildSearchSettingsPatch,
	type SearchSettingsState,
} from '../adminSearchConfigApi';

function makeBaseSettings(): SearchSettingsState {
	return {
		provider: 'yandex',
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
}

describe('adminSearchConfigApi payload builders', () => {
	it('returns undefined settings patch when draft equals base', () => {
		const base = makeBaseSettings();
		expect(buildSearchSettingsPatch(base, base)).toBeUndefined();
	});

	it('builds settings patch for changed scalar, cache, and surface toggles', () => {
		const base = makeBaseSettings();
		const draft = makeBaseSettings();
		draft.cache_enabled = false;
		draft.cache_ttl_sec = 600;
		draft.surfaces.ugs = false;
		const patch = buildSearchSettingsPatch(base, draft);
		expect(patch).toEqual({
			cache_enabled: false,
			cache_ttl_sec: 600,
			surfaces: {
				desktop: true,
				ewa: true,
				marketing: true,
				imperorg: true,
				ugs: false,
			},
		});
	});

	it('builds secrets patch with rotate and clear actions', () => {
		const patch = buildSearchSecretsPatch({
			yandexApiKeyInput: 'new-api-key',
			yandexFolderIdInput: '',
			clearYandexApiKey: false,
			clearYandexFolderId: true,
		});
		expect(patch).toEqual({
			yandex_api_key: { action: 'rotate', value: 'new-api-key' },
			yandex_folder_id: { action: 'clear' },
		});
	});

	it('returns undefined patch body when no changes and no note', () => {
		const base = makeBaseSettings();
		const body = buildSearchConfigPatchBody({
			base,
			draft: makeBaseSettings(),
			secrets: {
				yandexApiKeyInput: '',
				yandexFolderIdInput: '',
				clearYandexApiKey: false,
				clearYandexFolderId: false,
			},
			note: '   ',
		});
		expect(body).toBeUndefined();
	});
});
