/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for UGS Admin v2 model_routes.patch allowlist and model_routes.replace payloads.
 *
 * Invariants:
 * - patch uses emptyRoutesPatch() + single field for partial updates.
 * - replace validates full UgsAdminV2ModelRoutesDTO shape from JSON text.
 *
 * Related:
 * - src/features/ugs/admin-v2/tabs/ModelsTabV2.tsx
 */

import type {
	UgsAdminV2BulkOperation,
	UgsAdminV2ModelRoutesDTO,
} from '@/services/api/ugsAdminV2';

export function emptyRoutesPatch(): UgsAdminV2ModelRoutesDTO {
	return {
		global_default_model: null,
		provider_defaults: {},
		category_defaults: {},
		domain_defaults: {},
		type_overrides: {},
		request_model_override_allowlist: [],
	};
}

export function parseCsvList(raw: string): string[] {
	return raw
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

export function allowlistCsvFromRoutes(
	routes: UgsAdminV2ModelRoutesDTO
): string {
	return (routes.request_model_override_allowlist ?? []).join(', ');
}

export function buildAllowlistPatch(csv: string): UgsAdminV2ModelRoutesDTO {
	const routes = emptyRoutesPatch();
	routes.request_model_override_allowlist = parseCsvList(csv);
	return routes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(
	value: unknown
): value is Record<string, string | null> {
	if (!isRecord(value)) return false;
	return Object.values(value).every((v) => v === null || typeof v === 'string');
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === 'string')
	);
}

export function parseModelRoutesReplace(
	raw: string,
	invalidJsonMessage: string
): { routes: UgsAdminV2ModelRoutesDTO | null; errors: string[] } {
	const errors: string[] = [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw.trim() || '{}');
	} catch {
		return { routes: null, errors: [invalidJsonMessage] };
	}

	if (!isRecord(parsed)) {
		return { routes: null, errors: ['model_routes: must be a JSON object'] };
	}

	const globalDefault = parsed.global_default_model;
	if (
		globalDefault !== undefined &&
		globalDefault !== null &&
		typeof globalDefault !== 'string'
	) {
		errors.push('global_default_model: must be string or null');
	}

	for (const key of [
		'provider_defaults',
		'category_defaults',
		'domain_defaults',
		'type_overrides',
	] as const) {
		if (parsed[key] !== undefined && !isStringRecord(parsed[key])) {
			errors.push(`${key}: must be an object of string|null values`);
		}
	}

	if (
		parsed.request_model_override_allowlist !== undefined &&
		!isStringArray(parsed.request_model_override_allowlist)
	) {
		errors.push('request_model_override_allowlist: must be a string array');
	}

	if (errors.length) return { routes: null, errors };

	const routes: UgsAdminV2ModelRoutesDTO = {
		global_default_model:
			globalDefault === undefined
				? null
				: globalDefault === null
					? null
					: String(globalDefault),
		provider_defaults: (parsed.provider_defaults ?? {}) as Record<
			string,
			string | null
		>,
		category_defaults: (parsed.category_defaults ?? {}) as Record<
			string,
			string | null
		>,
		domain_defaults: (parsed.domain_defaults ?? {}) as Record<
			string,
			string | null
		>,
		type_overrides: (parsed.type_overrides ?? {}) as Record<
			string,
			string | null
		>,
		request_model_override_allowlist:
			(parsed.request_model_override_allowlist as string[] | undefined) ?? [],
	};

	return { routes, errors: [] };
}

export function buildModelRoutesReplaceOperation(
	raw: string,
	invalidJsonMessage: string
): { operation: UgsAdminV2BulkOperation | null; errors: string[] } {
	const { routes, errors } = parseModelRoutesReplace(raw, invalidJsonMessage);
	if (!routes || errors.length) return { operation: null, errors };
	return {
		operation: { kind: 'model_routes.replace', routes },
		errors: [],
	};
}
