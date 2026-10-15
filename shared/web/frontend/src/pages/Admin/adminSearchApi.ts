/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed Admin API client for search hub: config, meta, probe, test-search, audit.
 *
 * Invariants:
 * - Re-exports config helpers from adminSearchConfigApi; secrets remain write-only.
 *
 * Related:
 * - `api/routers/desktop_admin_search_config.py`
 * - `pages/Admin/search/SearchAdminSection.tsx`
 */

export {
	type SearchConfigBootstrapBody,
	type SearchConfigPatchBody,
	type SearchConfigResponse,
	type SearchEffectiveResponse,
	type SearchProvider,
	type SearchSecretDraftState,
	type SearchSettingsState,
	type SearchSurfaceKey,
	bootstrapAdminSearchConfig,
	buildSearchConfigPatchBody,
	getAdminSearchConfig,
	getAdminSearchEffective,
	patchAdminSearchConfig,
} from './adminSearchConfigApi';

import { api } from '../../services/api/client';
import type { SearchSurfaceKey } from './adminSearchConfigApi';

const BASE = '/api/v1/desktop/admin/search-config';

export type SearchAdminTab =
	| 'overview'
	| 'settings'
	| 'surfaces'
	| 'test'
	| 'diagnostics'
	| 'audit'
	| 'quota'
	| 'stats';

export interface SearchMetaSurface {
	id: SearchSurfaceKey;
	enabled: boolean;
	resolved_provider: string | null;
	source: 'db' | 'env';
	blockers: string[];
}

export interface SearchMetaCache {
	enabled: boolean;
	ttl_sec: number;
	empty_ttl_sec: number;
}

export interface SearchMetaHealth {
	last_success_at: string | null;
	error_streak: number;
	errors_last_hour: number;
	probe_recommended: boolean;
}

export interface SearchMetaResponse {
	config_source: 'db' | 'env';
	updated_by: string | null;
	updated_at: string | null;
	provider: 'yandex';
	resolved_provider: string | null;
	providers: {
		yandex: {
			api_key_configured: boolean;
			folder_configured: boolean;
			credentials_ready: boolean;
		};
	};
	cache: SearchMetaCache;
	health: SearchMetaHealth;
	quota: {
		enforced: boolean;
		monthly_free_default: number;
		default_limit: number;
	};
	surfaces: SearchMetaSurface[];
	capabilities: {
		test_search: boolean;
		probe: boolean;
		audit: boolean;
		stats: boolean;
	};
}

export interface SearchProbeResult {
	target: string;
	ok: boolean;
	latency_ms: number;
	http_status: number | null;
	error_code: string | null;
	message: string;
	hit_count: number;
}

export interface SearchProbeResponse {
	smoke_query: string;
	results: SearchProbeResult[];
}

export interface SearchProbeBody {
	smoke_query?: string;
}

export interface SearchTestSearchBody {
	query: string;
	surface?: SearchSurfaceKey;
	limit?: number;
	consume_quota?: boolean;
	simulate_chat_query?: boolean;
	user_id?: string;
}

export interface SearchHitRow {
	title: string;
	content: string;
	url: string;
}

export interface SearchTestSearchResponse {
	status: 'ok' | 'blocked' | 'empty' | 'error';
	blockers: string[];
	surface: SearchSurfaceKey | null;
	provider: string | null;
	query_original: string;
	query_effective: string;
	latency_ms: number;
	hits: SearchHitRow[];
	prompt_preview: string;
	quota: Record<string, number | string> | null;
}

export interface SearchQueryPreviewBody {
	query: string;
	simulate_chat_query?: boolean;
}

export interface SearchQueryPreviewResponse {
	query_original: string;
	query_effective: string;
}

export interface SearchStatsSurfaceRow {
	surface: string;
	total: number;
}

export type SearchStatsPeriod = '24h' | '7d';

export interface SearchStatsResponse {
	period: SearchStatsPeriod;
	since: string;
	total: number;
	ok: number;
	empty: number;
	error: number;
	blocked: number;
	quota_denied: number;
	empty_rate: number;
	error_rate: number;
	cache_hits: number;
	cache_hit_rate: number;
	latency_ms_p50: number;
	latency_ms_p95: number;
	by_surface: SearchStatsSurfaceRow[];
}

export interface SearchAuditItem {
	id: string;
	actor_user_id: string | null;
	action: string;
	note: string | null;
	created_at: string | null;
	settings_changed: string[];
	secrets_changed: string[];
	before_settings: Record<string, unknown>;
	after_settings: Record<string, unknown>;
	before_secrets_status: Record<string, unknown>;
	after_secrets_status: Record<string, unknown>;
}

export interface SearchAuditListResponse {
	total: number;
	limit: number;
	offset: number;
	items: SearchAuditItem[];
}

export async function getAdminSearchMeta(): Promise<SearchMetaResponse> {
	return api.get<SearchMetaResponse>(`${BASE}/meta`);
}

export async function postAdminSearchProbe(
	body: SearchProbeBody
): Promise<SearchProbeResponse> {
	return api.post<SearchProbeResponse>(`${BASE}/probe`, body);
}

export async function postAdminSearchTest(
	body: SearchTestSearchBody
): Promise<SearchTestSearchResponse> {
	return api.post<SearchTestSearchResponse>(`${BASE}/test-search`, body);
}

export async function postAdminSearchQueryPreview(
	body: SearchQueryPreviewBody
): Promise<SearchQueryPreviewResponse> {
	return api.post<SearchQueryPreviewResponse>(`${BASE}/query-preview`, body);
}

export async function getAdminSearchStats(
	period: SearchStatsPeriod = '24h'
): Promise<SearchStatsResponse> {
	return api.get<SearchStatsResponse>(
		`${BASE}/stats?period=${encodeURIComponent(period)}`
	);
}

export async function getAdminSearchAudit(args?: {
	limit?: number;
	offset?: number;
	actor_user_id?: string;
}): Promise<SearchAuditListResponse> {
	const params = new URLSearchParams();
	if (args?.limit != null) params.set('limit', String(args.limit));
	if (args?.offset != null) params.set('offset', String(args.offset));
	if (args?.actor_user_id) params.set('actor_user_id', args.actor_user_id);
	const qs = params.toString();
	return api.get<SearchAuditListResponse>(`${BASE}/audit${qs ? `?${qs}` : ''}`);
}
