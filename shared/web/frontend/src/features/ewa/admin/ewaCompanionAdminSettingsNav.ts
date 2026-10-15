/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Helpers for cross-tab navigation to EWA platform settings (env_gate links, focus key).
 *
 * Related:
 * - src/features/ewa/admin/EwaCompanionSettingsTab.tsx
 * - documentation/product/ewa/EWA-COMPANION-ADMIN-SETTINGS-NAVIGATION.md
 */
import type { EwaCompanionPlatformSetting } from './ewaCompanionAdminApi';

const EWA_SETTING_KEY_PATTERN = /^EWA_[A-Z0-9_]+$/;

export function isEwaPlatformSettingKey(
	value: string | null | undefined
): boolean {
	if (!value) {
		return false;
	}
	return EWA_SETTING_KEY_PATTERN.test(value.trim());
}

export function findPlatformSettingCategory(
	settings: EwaCompanionPlatformSetting[],
	settingKey: string
): string | null {
	const row = settings.find((s) => s.setting_key === settingKey);
	return row?.category ?? null;
}
