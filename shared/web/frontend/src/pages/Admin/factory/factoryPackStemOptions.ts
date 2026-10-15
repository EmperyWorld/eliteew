/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Seed options for Factory PackStemPicker (no list API yet — operator can add custom).
 *
 * Invariants:
 * - Not imported by pages/Admin/ui atoms (options stay in feature layer).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

export const FACTORY_PACK_STEM_OPTIONS = [
	'notifications',
	'music_forge',
	'module_anatomy',
	'desktop_mount_catalog',
	'verify_gates',
	'service_factory',
	'desktop_shell_kernel',
] as const;
