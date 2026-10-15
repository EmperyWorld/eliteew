/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed HTTP client for EWA Runtime Gateway read-side (`/api/v1/ewa/runtime-context*`): context snapshot and paginated
 * content inventory shared by EWA UI, companion, and orchestration surfaces.
 *
 * Invariants:
 * - The client never sends user ids; auth scope is derived by the backend.
 * - Large content inventories are requested page-by-page and must honor `total`/`truncated`.
 * - HTTP generics use OpenAPI aliases from `ewaOpenApi.ts`; normalize fills optional arrays/defaults for UI.
 *
 * Related:
 * - shared/api/ewa_platform/gateways/routers/runtime_context.py
 * - src/services/ewa/ewaOpenApi.ts
 */
import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { apiClient } from '@/services/api/client';

import type {
	EwaRuntimeCatalogFilters,
	EwaRuntimeCompanionStatusOut,
	EwaRuntimeContentItemOut,
	EwaRuntimeContentPageOut,
	EwaRuntimeContextOut,
	EwaRuntimeDesktopHintsOut,
	EwaRuntimeLimitsOut,
	EwaRuntimePrincipalOut,
} from './ewaOpenApi';

export const EWA_RUNTIME_CONTEXT_PATH = '/ewa/runtime-context' as const;
export const EWA_RUNTIME_CONTEXT_CONTENT_PATH =
	'/ewa/runtime-context/content' as const;

export type EwaRuntimePrincipal = EwaRuntimePrincipalOut;
export type EwaRuntimeCompanionStatus = EwaRuntimeCompanionStatusOut;
export type EwaRuntimeContentItem = EwaRuntimeContentItemOut;

const EMPTY_CATALOG_FILTERS: EwaRuntimeCatalogFilters = {
	content_types: [],
	mime_groups: [],
	extension_include: [],
	extension_exclude: [],
};

/** Normalized content page — `items` and `applied_filters` always present for UI. */
export type EwaRuntimeContentPage = Omit<
	EwaRuntimeContentPageOut,
	'items' | 'applied_filters'
> & {
	items: EwaRuntimeContentItemOut[];
	applied_filters: EwaRuntimeCatalogFilters;
};

/** Normalized runtime context — nested blobs always present for UI. */
export type EwaRuntimeContext = Omit<
	EwaRuntimeContextOut,
	'content' | 'desktop' | 'limits'
> & {
	content: EwaRuntimeContentPage;
	desktop: EwaRuntimeDesktopHintsOut;
	limits: EwaRuntimeLimitsOut;
};

export type EwaRuntimeContentQuery = {
	offset?: number;
	limit?: number;
	search?: string | null;
	search_scope?: 'metadata' | 'content' | 'hybrid';
	content_type?: string | null;
	content_types?: string[];
	mime_group?: string[];
	extension_include?: string[];
	extension_exclude?: string[];
	include_audio?: boolean | null;
	exclude_audio?: boolean | null;
	visibility?: string | null;
	sort_field?: string | null;
	sort_order?: string | null;
};

export function normalizeEwaRuntimeContentPage(
	raw: EwaRuntimeContentPageOut
): EwaRuntimeContentPage {
	return {
		...raw,
		items: Array.isArray(raw.items) ? raw.items : [],
		applied_filters: raw.applied_filters ?? EMPTY_CATALOG_FILTERS,
	};
}

export function normalizeEwaRuntimeContext(
	raw: EwaRuntimeContextOut
): EwaRuntimeContext {
	return {
		...raw,
		generated_at: raw.generated_at ?? new Date(0).toISOString(),
		content: normalizeEwaRuntimeContentPage(raw.content),
		desktop: raw.desktop ?? {
			source: 'not_attached',
			ewa_hints: null,
			recent_app_ids: [],
			recent_file_ids: [],
		},
		limits: raw.limits ?? {
			max_content_page_size: 200,
			default_content_page_size: 50,
			max_prompt_content_items: 120,
		},
	};
}

function cleanParams(params?: EwaRuntimeContentQuery): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(params ?? {})) {
		if (value !== undefined && value !== null && value !== '') {
			out[key] = value;
		}
	}
	return out;
}

export function buildEwaRuntimeContentPath(
	params?: EwaRuntimeContentQuery
): string {
	const clean = cleanParams(params);
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(clean)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				searchParams.append(key, String(item));
			}
		} else {
			searchParams.append(key, String(value));
		}
	}
	const q = searchParams.toString();
	return q
		? `${EWA_RUNTIME_CONTEXT_CONTENT_PATH}?${q}`
		: EWA_RUNTIME_CONTEXT_CONTENT_PATH;
}

export async function getEwaRuntimeContext(
	params?: EwaRuntimeContentQuery
): Promise<EwaRuntimeContext> {
	const res = await apiClient.get<EwaRuntimeContextOut>(
		EWA_RUNTIME_CONTEXT_PATH,
		{
			...API_OPTIONS,
			params: cleanParams(params),
		}
	);
	return normalizeEwaRuntimeContext(res.data);
}

export async function getEwaRuntimeContentPage(
	params?: EwaRuntimeContentQuery
): Promise<EwaRuntimeContentPage> {
	const res = await apiClient.get<EwaRuntimeContentPageOut>(
		EWA_RUNTIME_CONTEXT_CONTENT_PATH,
		{
			...API_OPTIONS,
			params: cleanParams(params),
		}
	);
	return normalizeEwaRuntimeContentPage(res.data);
}
