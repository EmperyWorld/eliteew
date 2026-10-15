/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Localized labels for Professional Worlds photo-enhancement presets (pack/runtime plus fallback keys).
 *
 * Invariants:
 * - Keys under `properties.photoPresetFallback.<preset_key>` override English defaults from code when present.
 * - Missing translation falls back to the preset’s `display_name` (typically from runtime pack).
 *
 * Related:
 * - ProfessionalMediaWorkbench.tsx → mediaWorkbench/constants.ts (`PW_FALLBACK_PHOTO_PRESETS`)
 * - ProfessionalWorldsApp.tsx (quick-enhance preset `<select>`)
 */

import type { TFunction } from 'i18next';

export interface PhotoPresetOption {
	readonly preset_key: string;
	readonly display_name: string;
}

export function photoPresetDisplayName(
	preset: PhotoPresetOption,
	t: TFunction
): string {
	return t(`properties.photoPresetFallback.${preset.preset_key}`, {
		defaultValue: preset.display_name,
	});
}
