/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import {
	findPlatformSettingCategory,
	isEwaPlatformSettingKey,
} from '../ewaCompanionAdminSettingsNav';

describe('ewaCompanionAdminSettingsNav', () => {
	it('detects EWA platform setting keys', () => {
		expect(isEwaPlatformSettingKey('EWA_COMPANION_WF_MUSIC_FULL_V1')).toBe(
			true
		);
		expect(isEwaPlatformSettingKey('not_a_key')).toBe(false);
	});

	it('finds category for a known setting row', () => {
		expect(
			findPlatformSettingCategory(
				[
					{
						setting_key: 'EWA_COMPANION_ADMIN_WRITE',
						value_text: '1',
						value_type: 'bool',
						category: 'companion',
						title_ru: '',
						title_en: '',
						description_ru: '',
						description_en: '',
						default_value: '0',
						allowed_values: '',
						affects_ru: '',
						affects_en: '',
						is_secret: false,
						value_masked: false,
						sort_order: 0,
					},
				],
				'EWA_COMPANION_ADMIN_WRITE'
			)
		).toBe('companion');
	});

	it('returns null when setting key is missing from list', () => {
		expect(
			findPlatformSettingCategory([], 'EWA_COMPANION_WF_ENGINE_ENABLED')
		).toBe(null);
	});
});
