/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profession-pack helpers: vertical-scoped addon modules, nav labels from runtime config,
 * and gates for vertical-specific workspaces (e.g. realtor listing catalog).
 *
 * Invariants:
 * - Vertical pack addon keys use the `{vertical_slug}_` prefix (e.g. `realtor_leads`).
 * - Listing/object workspace is enabled only when the `objects` module is on and the vertical exposes the catalog API.
 * - Side-effect free for Vitest.
 *
 * Related:
 * - runtimeModuleRegistry.tsx
 * - realtorLogic.ts (realtor DTO helpers)
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import { getRuntimeModuleRegistryEntry } from './runtimeModuleRegistry';
import {
	filterVerticalPackAddonModuleKeys,
	isVerticalPackNavOnlyModuleKey,
} from './runtimeModuleMount';
import type { TFunction } from 'i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import type { ProfessionalRuntimeModule } from './types';
import { PROFESSIONAL_WORLDS_VERTICAL_REALTOR } from './types';

function humanizeModuleKey(moduleKey: string): string {
	return moduleKey.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const GENERIC_RUNTIME_MODULE_NAMES_BY_KEY: Record<string, Set<string>> = {
	realtor_playbooks: new Set([
		'ai playbooks',
		'ai-playbooks',
		'ai плейбуки',
		'ai-плейбуки',
	]),
};

/** Prefix for modules that belong to a vertical pack, not the shared core catalog. */
export function verticalPackModulePrefix(verticalSlug: string): string {
	const trimmed = verticalSlug.trim();
	return trimmed.length > 0 ? `${trimmed}_` : '';
}

export function isVerticalPackAddonModuleKey(
	moduleKey: string,
	verticalSlug: string
): boolean {
	const prefix = verticalPackModulePrefix(verticalSlug);
	return prefix.length > 0 && moduleKey.startsWith(prefix);
}

/** True when a module key should mount in the profession-tools stack (known dedicated registry panel). */
export function shouldIncludeDedicatedVerticalAddon(
	moduleKey: string
): boolean {
	if (isVerticalPackNavOnlyModuleKey(moduleKey)) {
		return false;
	}
	const entry = getRuntimeModuleRegistryEntry(moduleKey);
	if (!entry) {
		return false;
	}
	return entry.panelKind === 'dedicated';
}

/** Enabled vertical-pack addon modules, ordered for workspace stacking. Omits registry placeholder panels. */
export function sortedEnabledVerticalAddonModules(
	modules: ProfessionalRuntimeModule[],
	verticalSlug: string
): ProfessionalRuntimeModule[] {
	return filterVerticalPackAddonModuleKeys(modules, verticalSlug)
		.filter((mod) => shouldIncludeDedicatedVerticalAddon(mod.module_key))
		.slice()
		.sort((a, b) => a.sort_order - b.sort_order);
}

/** User-facing label for locked nav tooltips and status copy (no raw module_key). */
export function resolveRuntimeModuleUserLabel(
	t: TFunction<typeof PROFESSIONAL_WORLDS_NS>,
	moduleKey: string,
	runtimeModule: ProfessionalRuntimeModule | undefined,
	navFallback: string
): string {
	const labelKey = `professionTools.modules.${moduleKey}.label`;
	const localized = t(labelKey);
	if (localized !== labelKey) {
		return localized;
	}
	return resolveRuntimeModuleNavLabel(
		runtimeModule,
		navFallback.trim().length > 0 ? navFallback : humanizeModuleKey(moduleKey)
	);
}

export function resolveRuntimeModuleNavLabel(
	runtimeModule: ProfessionalRuntimeModule | undefined,
	fallback: string
): string {
	if (!runtimeModule) {
		return fallback;
	}
	const name = runtimeModule.module_name?.trim();
	if (!name || name.length === 0) {
		return fallback;
	}
	const genericNames =
		GENERIC_RUNTIME_MODULE_NAMES_BY_KEY[runtimeModule.module_key] ?? null;
	if (genericNames?.has(name.toLowerCase())) {
		return fallback;
	}
	return name;
}

export function runtimeModuleKeysMatch(left: string, right: string): boolean {
	const normalize = (value: string) =>
		value.trim().toLowerCase().replace(/_/g, '-');
	const a = normalize(left);
	const b = normalize(right);
	return a.length > 0 && a === b;
}

export function findRuntimeModule(
	modules: ProfessionalRuntimeModule[] | undefined,
	moduleKey: string
): ProfessionalRuntimeModule | undefined {
	return modules?.find((mod) =>
		runtimeModuleKeysMatch(mod.module_key, moduleKey)
	);
}

/** Whether the Objects / listings workspace should load and appear for this vertical. */
export function verticalSupportsListingWorkspace(
	verticalSlug: string,
	modules: ProfessionalRuntimeModule[] | undefined
): boolean {
	const objectsEnabled = Boolean(
		modules?.some((mod) => mod.module_key === 'objects' && mod.is_enabled)
	);
	if (!objectsEnabled) {
		return false;
	}
	// Domain catalog API is realtor-specific until a generic professional_objects layer exists.
	return verticalSlug === PROFESSIONAL_WORLDS_VERTICAL_REALTOR;
}
