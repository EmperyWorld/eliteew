/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Canonical mount matrix for Professional Worlds runtime modules — where each module_key
 * surfaces in Desktop (nav, addon stack, embedded sub-UI, or admin catalog only).
 *
 * Invariants:
 * - Vertical-pack keys with `{vertical_slug}_` prefix default to `addon` unless listed in nav-only set.
 * - Embedded modules (`deals`, `media-studio`) gate sub-UI inside parent nav views, not sidebar entries.
 * - Snapshot fetch helpers align with the same enablement rules.
 *
 * Related:
 * - verticalModuleLogic.ts
 * - documentation/product/PROFESSIONAL-WORLDS.md (§ Runtime module mount matrix)
 */

import type {
	ProfessionalRuntimeModule,
	ProfessionalRuntimePhotoPreset,
} from './types';
import { PW_TEST_TS } from './professionalWorldsTestFixtures';
import {
	findRuntimeModule,
	runtimeModuleKeysMatch,
} from './verticalModuleLogic';

/** How a module_key is mounted in Desktop runtime. */
export type RuntimeModuleMountKind =
	| 'nav'
	| 'addon'
	| 'embedded'
	| 'admin_only';

/**
 * Core catalog modules with explicit mount kind (not vertical-pack addons).
 * Keys omitted here that use `{vertical}_` prefix are treated as `addon` when dedicated.
 */
export const RUNTIME_MODULE_MOUNT: Record<string, RuntimeModuleMountKind> = {
	profile: 'nav',
	objects: 'nav',
	clients: 'nav',
	deals: 'embedded',
	'media-studio': 'embedded',
	learning: 'nav',
	'public-presence': 'nav',
	artifacts: 'nav',
};

/**
 * Vertical-pack module keys that gate a top-level nav item but must not stack under Profession tools.
 */
export const VERTICAL_PACK_NAV_ONLY_MODULE_KEYS = new Set<string>([
	'realtor_playbooks',
]);

export function runtimeModuleMountKind(
	moduleKey: string
): RuntimeModuleMountKind {
	const trimmed = moduleKey.trim();
	if (!trimmed) {
		return 'admin_only';
	}
	return RUNTIME_MODULE_MOUNT[trimmed] ?? 'addon';
}

export function isVerticalPackNavOnlyModuleKey(moduleKey: string): boolean {
	return VERTICAL_PACK_NAV_ONLY_MODULE_KEYS.has(moduleKey.trim());
}

export function isRuntimeModuleEnabled(
	modules: ProfessionalRuntimeModule[] | undefined,
	moduleKey: string
): boolean {
	return Boolean(findRuntimeModule(modules, moduleKey)?.is_enabled);
}

export function shouldFetchProfileSnapshot(
	modules: ProfessionalRuntimeModule[] | undefined
): boolean {
	return isRuntimeModuleEnabled(modules, 'profile');
}

export function shouldFetchClientsSnapshot(
	modules: ProfessionalRuntimeModule[] | undefined
): boolean {
	return isRuntimeModuleEnabled(modules, 'clients');
}

/** Deals UI lives inside Clients; fetch when either deals or clients module is on. */
export function shouldFetchDealsSnapshot(
	modules: ProfessionalRuntimeModule[] | undefined
): boolean {
	return (
		isRuntimeModuleEnabled(modules, 'deals') ||
		isRuntimeModuleEnabled(modules, 'clients')
	);
}

export function shouldFetchLearningSnapshot(
	modules: ProfessionalRuntimeModule[] | undefined
): boolean {
	return isRuntimeModuleEnabled(modules, 'learning');
}

export function shouldFetchArtifactsSnapshot(
	modules: ProfessionalRuntimeModule[] | undefined
): boolean {
	return isRuntimeModuleEnabled(modules, 'artifacts');
}

export type RuntimePhotoPresetLike = Pick<
	ProfessionalRuntimePhotoPreset,
	'preset_key' | 'display_name'
>;

function coerceRuntimePhotoPreset(
	row: RuntimePhotoPresetLike,
	index: number
): ProfessionalRuntimePhotoPreset {
	return {
		id: `fallback-${row.preset_key}`,
		vertical_slug: '',
		preset_key: row.preset_key,
		display_name: row.display_name,
		description: null,
		category: 'fallback',
		action_type: 'photo_enhance',
		ugs_type_key: row.preset_key,
		parameters: {},
		is_active: true,
		sort_order: index,
		created_at: PW_TEST_TS,
		updated_at: PW_TEST_TS,
	};
}

export function resolveRuntimePhotoPresets(
	modules: ProfessionalRuntimeModule[] | undefined,
	presets: ProfessionalRuntimePhotoPreset[] | undefined,
	fallback: readonly RuntimePhotoPresetLike[]
): ProfessionalRuntimePhotoPreset[] {
	if (!isRuntimeModuleEnabled(modules, 'media-studio')) {
		return [];
	}
	const cfg = presets ?? [];
	if (cfg.length > 0) {
		return [...cfg];
	}
	return fallback.map(coerceRuntimePhotoPreset);
}

/** Enabled vertical-pack addon keys eligible for Profession tools stack. */
export function filterVerticalPackAddonModuleKeys(
	modules: ProfessionalRuntimeModule[],
	verticalSlug: string
): ProfessionalRuntimeModule[] {
	const prefix =
		verticalSlug.trim().length > 0 ? `${verticalSlug.trim()}_` : '';
	return modules.filter((mod) => {
		if (!mod.is_enabled || prefix.length === 0) {
			return false;
		}
		if (!mod.module_key.startsWith(prefix)) {
			return false;
		}
		if (isVerticalPackNavOnlyModuleKey(mod.module_key)) {
			return false;
		}
		return runtimeModuleMountKind(mod.module_key) === 'addon';
	});
}

export function runtimeModuleKeysEquivalent(
	left: string,
	right: string
): boolean {
	return runtimeModuleKeysMatch(left, right);
}
