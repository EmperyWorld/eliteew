/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import {
	EWA_SETTINGS_CATEGORY_ORDER,
	EWA_TOOL_CAPABILITY_ORDER,
	settingsCategoryHintI18nKey,
	settingsCategoryI18nKey,
	toolCapabilityHintI18nKey,
	toolCapabilityI18nKey,
	toolDescriptionI18nKey,
} from '../ewaCompanionAdminMeta';

describe('ewaCompanionAdminMeta', () => {
	it('exposes stable category and capability order', () => {
		expect(EWA_SETTINGS_CATEGORY_ORDER).toContain('agentic');
		expect(EWA_SETTINGS_CATEGORY_ORDER).toContain('companion');
		expect(EWA_SETTINGS_CATEGORY_ORDER).toContain('media');
		expect(EWA_SETTINGS_CATEGORY_ORDER.indexOf('agentic')).toBeLessThan(
			EWA_SETTINGS_CATEGORY_ORDER.indexOf('companion')
		);
		expect(EWA_SETTINGS_CATEGORY_ORDER.indexOf('companion')).toBeLessThan(
			EWA_SETTINGS_CATEGORY_ORDER.indexOf('media')
		);
		expect(EWA_TOOL_CAPABILITY_ORDER).toContain('music');
		expect(EWA_TOOL_CAPABILITY_ORDER.indexOf('music')).toBeLessThan(
			EWA_TOOL_CAPABILITY_ORDER.indexOf('desktop')
		);
	});

	it('builds i18n keys for settings and tools', () => {
		expect(settingsCategoryI18nKey('companion')).toBe(
			'ewaCompanionAdmin.settingsCategories.companion.title'
		);
		expect(settingsCategoryHintI18nKey('orchestration')).toBe(
			'ewaCompanionAdmin.settingsCategories.orchestration.hint'
		);
		expect(toolCapabilityI18nKey('music')).toBe(
			'ewaCompanionAdmin.toolCapabilities.music.title'
		);
		expect(toolCapabilityHintI18nKey('plans')).toBe(
			'ewaCompanionAdmin.toolCapabilities.plans.hint'
		);
		expect(toolDescriptionI18nKey('music_generation')).toBe(
			'ewaCompanionAdmin.toolDescriptions.music_generation'
		);
	});
});
