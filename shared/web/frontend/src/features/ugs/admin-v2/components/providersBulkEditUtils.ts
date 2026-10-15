/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers and shared types for UGS Admin v2 provider bulk edit (validation, config merge, baseline).
 *
 * Invariants:
 * - No React or side effects; safe for unit tests and ops preview builders.
 * - Text-model fields apply only to llama/miso provider types.
 *
 * Related:
 * - src/features/ugs/admin-v2/components/ProvidersBulkEditModal.tsx
 * - src/features/ugs/admin-v2/hooks/useProvidersBulkEditState.ts
 */

import type { UgsAdminV2SnapshotDTO } from '@/services/api/ugsAdminV2';

export type TriBool = '' | 'true' | 'false';
export type ProviderRole = '' | 'text' | 'image' | 'audio' | 'other';

export const TEXT_MODEL_PROVIDER_TYPES = new Set(['llama', 'llama', 'miso']);

export type Baseline = {
	display_label: string | null;
	base_url: string | null;
	health_endpoint: string | null;
	api_key_required: boolean | null;
	enabled: boolean | null;
	timeout_seconds: number | null;
	max_concurrent: number | null;
	cost_per_request: number | null;
	fallback_priority: number | null;
	fallback_for: string[] | null;
	default_model: string | null;
	models: string[] | null;
	config_json: Record<string, unknown> | null;
};

export function parseTriBool(v: TriBool): boolean | null {
	if (v === 'true') return true;
	if (v === 'false') return false;
	return null;
}

export function normalizeListCSV(raw: string): string[] | null {
	const items = raw
		.split(',')
		.map((x) => x.trim())
		.filter(Boolean);
	return items.length ? items : null;
}

export function safeJsonParseObject(raw: string): {
	value: Record<string, unknown> | null;
	errorKey: 'configJsonMustBeObject' | 'invalidJson' | null;
} {
	const text = raw.trim();
	if (!text) return { value: null, errorKey: null };
	try {
		const parsed: unknown = JSON.parse(text);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return { value: null, errorKey: 'configJsonMustBeObject' };
		}
		return { value: parsed as Record<string, unknown>, errorKey: null };
	} catch {
		return { value: null, errorKey: 'invalidJson' };
	}
}

export function mergeConfigJson(
	base: Record<string, unknown>,
	patch: Record<string, unknown>
): Record<string, unknown> {
	return { ...base, ...patch };
}

export function providerSupportsTextModelFields(provider: {
	provider_type?: string | null;
}): boolean {
	return TEXT_MODEL_PROVIDER_TYPES.has(
		String(provider.provider_type ?? '')
			.trim()
			.toLowerCase()
	);
}

export function cleanNonTextProviderConfig(
	provider: Pick<
		UgsAdminV2SnapshotDTO['providers'][number],
		'provider_type' | 'config_json'
	>
): Record<string, unknown> {
	const config = {
		...((provider.config_json ?? {}) as Record<string, unknown>),
	};
	if (providerSupportsTextModelFields(provider)) return config;
	delete config.default_model;
	delete config.models;
	if (
		String(config.provider_role ?? '')
			.trim()
			.toLowerCase() === 'text'
	) {
		delete config.provider_role;
	}
	return config;
}

export function commonValue<T>(items: T[]): T | null {
	if (!items.length) return null;
	const first = items[0];
	for (const it of items) {
		if (JSON.stringify(it) !== JSON.stringify(first)) return null;
	}
	return first;
}

export function toTriBool(v: boolean | null): TriBool {
	if (v === true) return 'true';
	if (v === false) return 'false';
	return '';
}
