/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared fallback photo presets when the Professional Worlds runtime pack
 * exposes no preset list for the media workbench.
 *
 * Invariants:
 * - Keys stay aligned with typical enhancement batch names used by quick-enhance.
 *
 * Related:
 * - photoPresetDisplay.ts
 * - ProfessionalMediaWorkbench.tsx (stable re-export)
 */

/** Fallback keys when runtime pack lists no photo presets — matches typical enhancement batch names. */
export const PW_FALLBACK_PHOTO_PRESETS: ReadonlyArray<{
	preset_key: string;
	display_name: string;
}> = [
	{ preset_key: 'realtor_hero_cover', display_name: 'Hero cover (16:9)' },
	{ preset_key: 'marketplace_crop', display_name: 'Marketplace crop' },
	{ preset_key: 'document_safe_cleanup', display_name: 'Document-safe tidy' },
	{ preset_key: 'premium_gallery', display_name: 'Premium gallery' },
];
