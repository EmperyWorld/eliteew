/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Browser-side cache for resolved Professional Worlds runtime configs by version hash.
 *
 * Invariants:
 * - Cache keys include the vertical slug and backend `config_version_hash`; stale rollout configs do not overwrite new hashes.
 * - Cache reads are best-effort and must never block live API loading.
 *
 * Related:
 * - api.ts
 * - types.ts
 */

import type { ProfessionalWorldsRuntimeConfig } from './types';

const CACHE_PREFIX = 'eliteew.professionalWorlds.runtimeConfig';

function storage(): Storage | null {
	return typeof window === 'undefined' ? null : window.localStorage;
}

function versionCacheKey(verticalSlug: string, versionHash: string): string {
	return `${CACHE_PREFIX}.${verticalSlug}.${versionHash}`;
}

function latestCacheKey(verticalSlug: string): string {
	return `${CACHE_PREFIX}.${verticalSlug}.latest`;
}

export function cacheProfessionalRuntimeConfig(
	config: ProfessionalWorldsRuntimeConfig
): void {
	const hash = config.config_version_hash;
	const store = storage();
	if (!store || !hash) {
		return;
	}
	store.setItem(
		versionCacheKey(config.vertical_slug, hash),
		JSON.stringify(config)
	);
	store.setItem(latestCacheKey(config.vertical_slug), hash);
}

export function readProfessionalRuntimeConfigCache(
	verticalSlug: string,
	versionHash: string
): ProfessionalWorldsRuntimeConfig | null {
	const store = storage();
	if (!store || !versionHash) {
		return null;
	}
	const raw = store.getItem(versionCacheKey(verticalSlug, versionHash));
	if (!raw) {
		return null;
	}
	try {
		return JSON.parse(raw) as ProfessionalWorldsRuntimeConfig;
	} catch {
		return null;
	}
}

export function readLatestProfessionalRuntimeConfigCache(
	verticalSlug: string
): ProfessionalWorldsRuntimeConfig | null {
	const store = storage();
	const latestHash = store?.getItem(latestCacheKey(verticalSlug));
	return latestHash
		? readProfessionalRuntimeConfigCache(verticalSlug, latestHash)
		: null;
}
