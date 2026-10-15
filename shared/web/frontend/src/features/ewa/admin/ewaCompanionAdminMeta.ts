/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared category/capability ordering and i18n key helpers for EWA companion admin UI.
 *
 * Invariants:
 * - Keys align with backend ``ewa_platform_setting.category`` and tool ``capability`` values.
 *
 * Related:
 * - src/features/ewa/admin/EwaCompanionSettingsTab.tsx
 * - src/features/ewa/admin/EwaCompanionToolsTab.tsx
 */

export const EWA_SETTINGS_CATEGORY_ORDER = [
	'agentic',
	'companion',
	'media',
	'orchestration',
	'persona',
	'atoms',
	'infrastructure',
	'misc',
] as const;

export type EwaSettingsCategory = (typeof EWA_SETTINGS_CATEGORY_ORDER)[number];

export const EWA_TOOL_CAPABILITY_ORDER = [
	'plans',
	'storage',
	'music',
	'desktop',
	'general',
] as const;

export type EwaToolCapability = (typeof EWA_TOOL_CAPABILITY_ORDER)[number];

export function settingsCategoryI18nKey(category: string): string {
	return `ewaCompanionAdmin.settingsCategories.${category}.title`;
}

export function settingsCategoryHintI18nKey(category: string): string {
	return `ewaCompanionAdmin.settingsCategories.${category}.hint`;
}

export function toolCapabilityI18nKey(capability: string): string {
	return `ewaCompanionAdmin.toolCapabilities.${capability}.title`;
}

export function toolCapabilityHintI18nKey(capability: string): string {
	return `ewaCompanionAdmin.toolCapabilities.${capability}.hint`;
}

export function toolDescriptionI18nKey(toolName: string): string {
	return `ewaCompanionAdmin.toolDescriptions.${toolName}`;
}
