/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared client-side validation for Professional Worlds admin key fields.
 *
 * Invariants:
 * - Keys are stable identifiers used by pack manifests and backend routes.
 * - `module_key` mirrors backend `normalize_module_key` (lowercase slug with hyphens).
 * - Other admin keys (action_key, preset_key, playbook) use lowercase letters, digits and underscores.
 *
 * Related:
 * - src/features/professional-worlds/admin/tabs/ModulesTab.tsx
 * - src/features/professional-worlds/admin/tabs/AiActionsTab.tsx
 * - src/features/professional-worlds/admin/tabs/PhotoPresetsTab.tsx
 */

import { adminText } from './adminI18n';

const ADMIN_IDENTIFIER_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const ADMIN_MODULE_KEY_PATTERN = /^[a-z][a-z0-9_-]*$/;

/** Same normalization as API `ProfessionalModuleBase.normalize_module_key`. */
export function normalizeAdminModuleKey(value: string): string {
	return value.trim().toLowerCase().replace(/_/g, '-');
}

export function validateAdminModuleKey(
	value: string,
	label: string
): string | null {
	const key = normalizeAdminModuleKey(value);
	if (!key) {
		return adminText('validation.keyRequired', { label });
	}
	if (!ADMIN_MODULE_KEY_PATTERN.test(key)) {
		return adminText('validation.moduleKeyPattern', { label });
	}
	return null;
}

export function validateAdminKey(value: string, label: string): string | null {
	const key = value.trim();
	if (!key) {
		return adminText('validation.keyRequired', { label });
	}
	if (!ADMIN_IDENTIFIER_KEY_PATTERN.test(key)) {
		return adminText('validation.keyPattern', { label });
	}
	return null;
}
