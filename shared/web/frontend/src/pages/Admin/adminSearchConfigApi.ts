/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed Admin API client for global web-search runtime config and secret patch payload builders.
 *
 * Invariants:
 * - Secret fields are write-only: plaintext values are sent only in PATCH operations.
 * - Read API exposes status metadata only (`configured`, `configured_in_db`, `value_masked`).
 *
 * Related:
 * - `api/routers/desktop_admin_search_config.py`
 * - `pages/Admin/DesktopSearchConfigSection.tsx`
 */

import { api } from '../../services/api/client';

const BASE = '/api/v1/desktop/admin/search-config';

export type SearchSurfaceKey =
	| 'desktop'
	| 'ewa'
	| 'marketing'
	| 'imperorg'
	| 'ugs';

export type SearchProvider = 'yandex';

export interface SearchSurfacesState {
	desktop: boolean;
	ewa: boolean;
	marketing: boolean;
	imperorg: boolean;
	ugs: boolean;
}

export interface SearchSettingsState {
	provider: SearchProvider;
	yandex_search_type: string;
	yandex_search_l10n: string;
	yandex_search_region: string;
	yandex_groups_on_page: number;
	cache_enabled: boolean;
	cache_ttl_sec: number;
	cache_empty_ttl_sec: number;
	quota_enforced: boolean;
	monthly_free_default: number;
	default_limit: number;
	surfaces: SearchSurfacesState;
}

export interface SearchSecretStatusState {
	configured: boolean;
	configured_in_db: boolean;
	value_masked: boolean;
}

export interface SearchConfigResponse {
	settings: SearchSettingsState;
	secrets: {
		yandex_api_key: SearchSecretStatusState;
		yandex_folder_id: SearchSecretStatusState;
	};
	source: 'db' | 'env';
	updated_by: string | null;
	updated_at: string | null;
}

export interface SearchEffectiveResponse {
	surface: SearchSurfaceKey | null;
	surface_enabled: boolean;
	source: 'db' | 'env';
	provider: SearchProvider;
	quota_enforced: boolean;
	monthly_free_default: number;
	default_limit: number;
	cache_enabled: boolean;
	yandex_search_configured: boolean;
	yandex_folder_configured: boolean;
	updated_by: string | null;
	updated_at: string | null;
}

export interface SearchSurfacesPatch {
	desktop?: boolean;
	ewa?: boolean;
	marketing?: boolean;
	imperorg?: boolean;
	ugs?: boolean;
}

export interface SearchSettingsPatch {
	yandex_search_type?: string;
	yandex_search_l10n?: string;
	yandex_search_region?: string;
	yandex_groups_on_page?: number;
	cache_enabled?: boolean;
	cache_ttl_sec?: number;
	cache_empty_ttl_sec?: number;
	quota_enforced?: boolean;
	monthly_free_default?: number;
	default_limit?: number;
	surfaces?: SearchSurfacesPatch;
}

export type SearchSecretAction = 'set' | 'rotate' | 'clear';

export interface SearchSecretPatch {
	action: SearchSecretAction;
	value?: string;
}

export interface SearchConfigPatchBody {
	settings?: SearchSettingsPatch;
	secrets?: {
		yandex_api_key?: SearchSecretPatch;
		yandex_folder_id?: SearchSecretPatch;
	};
	note?: string;
}

export interface SearchConfigBootstrapBody {
	force?: boolean;
	note?: string;
}

export interface SearchSecretDraftState {
	yandexApiKeyInput: string;
	yandexFolderIdInput: string;
	clearYandexApiKey: boolean;
	clearYandexFolderId: boolean;
}

function normalizeSearchText(value: string): string {
	return value.trim();
}

function settingsSurfacesEqual(
	left: SearchSurfacesState,
	right: SearchSurfacesState
): boolean {
	return (
		left.desktop === right.desktop &&
		left.ewa === right.ewa &&
		left.marketing === right.marketing &&
		left.imperorg === right.imperorg &&
		left.ugs === right.ugs
	);
}

export function buildSearchSettingsPatch(
	base: SearchSettingsState,
	draft: SearchSettingsState
): SearchSettingsPatch | undefined {
	const patch: SearchSettingsPatch = {};
	if (base.yandex_search_type !== draft.yandex_search_type) {
		patch.yandex_search_type = normalizeSearchText(draft.yandex_search_type);
	}
	if (base.yandex_search_l10n !== draft.yandex_search_l10n) {
		patch.yandex_search_l10n = normalizeSearchText(draft.yandex_search_l10n);
	}
	if (base.yandex_search_region !== draft.yandex_search_region) {
		patch.yandex_search_region = normalizeSearchText(
			draft.yandex_search_region
		);
	}
	if (base.yandex_groups_on_page !== draft.yandex_groups_on_page) {
		patch.yandex_groups_on_page = draft.yandex_groups_on_page;
	}
	if (base.cache_enabled !== draft.cache_enabled) {
		patch.cache_enabled = draft.cache_enabled;
	}
	if (base.cache_ttl_sec !== draft.cache_ttl_sec) {
		patch.cache_ttl_sec = draft.cache_ttl_sec;
	}
	if (base.cache_empty_ttl_sec !== draft.cache_empty_ttl_sec) {
		patch.cache_empty_ttl_sec = draft.cache_empty_ttl_sec;
	}
	if (base.quota_enforced !== draft.quota_enforced) {
		patch.quota_enforced = draft.quota_enforced;
	}
	if (base.monthly_free_default !== draft.monthly_free_default) {
		patch.monthly_free_default = draft.monthly_free_default;
	}
	if (base.default_limit !== draft.default_limit) {
		patch.default_limit = draft.default_limit;
	}
	if (!settingsSurfacesEqual(base.surfaces, draft.surfaces)) {
		patch.surfaces = { ...draft.surfaces };
	}
	return Object.keys(patch).length ? patch : undefined;
}

export function buildSearchSecretsPatch(
	draft: SearchSecretDraftState
): SearchConfigPatchBody['secrets'] | undefined {
	const patch: SearchConfigPatchBody['secrets'] = {};
	const keyValue = normalizeSearchText(draft.yandexApiKeyInput);
	const folderValue = normalizeSearchText(draft.yandexFolderIdInput);

	if (draft.clearYandexApiKey) {
		patch.yandex_api_key = { action: 'clear' };
	} else if (keyValue) {
		patch.yandex_api_key = { action: 'rotate', value: keyValue };
	}

	if (draft.clearYandexFolderId) {
		patch.yandex_folder_id = { action: 'clear' };
	} else if (folderValue) {
		patch.yandex_folder_id = { action: 'rotate', value: folderValue };
	}

	return Object.keys(patch).length ? patch : undefined;
}

export function buildSearchConfigPatchBody(args: {
	base: SearchSettingsState;
	draft: SearchSettingsState;
	secrets: SearchSecretDraftState;
	note?: string;
}): SearchConfigPatchBody | undefined {
	const settingsPatch = buildSearchSettingsPatch(args.base, args.draft);
	const secretsPatch = buildSearchSecretsPatch(args.secrets);
	const note = normalizeSearchText(args.note || '');
	if (!settingsPatch && !secretsPatch && !note) {
		return undefined;
	}
	const body: SearchConfigPatchBody = {};
	if (settingsPatch) {
		body.settings = settingsPatch;
	}
	if (secretsPatch) {
		body.secrets = secretsPatch;
	}
	if (note) {
		body.note = note;
	}
	return body;
}

export async function getAdminSearchConfig(): Promise<SearchConfigResponse> {
	return api.get<SearchConfigResponse>(`${BASE}/config`);
}

export async function patchAdminSearchConfig(
	body: SearchConfigPatchBody
): Promise<SearchConfigResponse> {
	return api.patch<SearchConfigResponse>(`${BASE}/config`, body);
}

export async function bootstrapAdminSearchConfig(
	body: SearchConfigBootstrapBody
): Promise<SearchConfigResponse> {
	return api.post<SearchConfigResponse>(`${BASE}/config/bootstrap-env`, body);
}

export async function getAdminSearchEffective(
	surface?: SearchSurfaceKey
): Promise<SearchEffectiveResponse> {
	const suffix = surface ? `?surface=${encodeURIComponent(surface)}` : '';
	return api.get<SearchEffectiveResponse>(`${BASE}/effective${suffix}`);
}
