/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * List, folder-view, search, stats, and activity endpoints for Unified Content.
 *
 * Invariants:
 * - Query params omit null/empty values before hitting REST routes.
 *
 * Related:
 * - src/services/contentApi/normalizers.ts
 */
import type { AxiosRequestConfig } from 'axios';
import type {
	Content,
	ContentStats,
} from '../../components/UnifiedContent/types';
import { api } from '../api';
import {
	normalizeContentItem,
	normalizeContentListResponse,
	normalizeFolderViewResponse,
	normalizeManagerActivityRow,
	normalizeSearchResponse,
} from './normalizers';
import type {
	BrokenContentListResponse,
	ContentAdvancedSearchParams,
	ContentAutocompleteSuggestion,
	ContentItemApiPayload,
	ContentListApiPayload,
	ContentListQuery,
	ContentListResult,
	ContentSearchApiPayload,
	ContentSearchResponse,
	ContentViewHistoryApiItem,
	FolderViewApiPayload,
	FolderViewQuery,
	FolderViewResult,
	ManagerActivityApiRow,
	StorageRecheckResponse,
} from './types';
import {
	buildContentRequestConfig,
	toNumberValue,
	toQueryParams,
	toStringValue,
} from './utils';

async function getFolderView(
	query: FolderViewQuery,
	config?: AxiosRequestConfig
): Promise<FolderViewResult> {
	const payload = await api.get<FolderViewApiPayload>('/content/folder-view', {
		...buildContentRequestConfig(config),
		params: toQueryParams({
			folder_item_id: query.folderItemId,
			folder_unassigned: query.unfiled,
			search: query.search,
			sort_field: query.sort?.field,
			sort_order: query.sort?.order,
			limit: query.limit,
			offset: query.offset,
			content_type: query.contentType,
			mime_type: query.mimeType,
			min_file_size: query.minFileSize,
			processing_status: query.processingStatus,
		}),
	});
	return normalizeFolderViewResponse(payload);
}

async function listContent(
	query: ContentListQuery = {},
	config?: AxiosRequestConfig
): Promise<ContentListResult> {
	const payload = await api.get<ContentListApiPayload>('/content', {
		...buildContentRequestConfig(config),
		params: toQueryParams(query),
	});
	return normalizeContentListResponse(payload as unknown);
}

async function listContentMultiVersion(
	query: Pick<ContentListQuery, 'offset' | 'limit'> = {},
	config?: AxiosRequestConfig
): Promise<ContentListResult> {
	const payload = await api.get<ContentListApiPayload>(
		'/content/multi-version',
		{
			...buildContentRequestConfig(config),
			params: toQueryParams(query),
		}
	);
	return normalizeContentListResponse(payload as unknown);
}

async function getContent(
	contentId: string,
	config?: AxiosRequestConfig
): Promise<Content> {
	const payload = await api.get<ContentItemApiPayload>(
		`/content/${contentId}`,
		buildContentRequestConfig(config)
	);
	return normalizeContentItem(payload as unknown);
}

async function getCurrentUserId(): Promise<string> {
	const payload = await api.get<{ user_id?: unknown }>(
		'/content/me',
		buildContentRequestConfig()
	);
	return toStringValue(payload.user_id);
}

async function getStats(): Promise<ContentStats> {
	return api.get<ContentStats>(
		'/content/statistics',
		buildContentRequestConfig()
	);
}

async function getFolderTotals(): Promise<{
	by_folder_item_id: Record<string, number>;
	unfiled: number;
	total: number;
}> {
	const payload = await api.get<{
		by_folder_item_id?: Record<string, unknown>;
		unfiled?: unknown;
		total?: unknown;
	}>('/content/folder-totals', buildContentRequestConfig());
	const raw = payload.by_folder_item_id ?? {};
	const by_folder_item_id: Record<string, number> = {};
	for (const [key, value] of Object.entries(raw)) {
		const n = typeof value === 'number' ? value : Number(value);
		if (Number.isFinite(n) && n > 0) {
			by_folder_item_id[key] = n;
		}
	}
	return {
		by_folder_item_id,
		unfiled: Number(payload.unfiled) || 0,
		total: Number(payload.total) || 0,
	};
}

async function getFolderPreviews(
	folderItemIds: readonly string[],
	perFolderLimit = 4
): Promise<{
	by_folder_item_id: Record<
		string,
		Array<{ id: string; content_type: string; mime_type: string | null }>
	>;
	per_folder_limit: number;
}> {
	const ids = [
		...new Set(
			folderItemIds.map((id) => id.trim()).filter((id) => id.length > 0)
		),
	];
	if (ids.length === 0) {
		return { by_folder_item_id: {}, per_folder_limit: perFolderLimit };
	}
	const params = new URLSearchParams();
	params.set('folder_item_ids', ids.join(','));
	params.set('per_folder_limit', String(perFolderLimit));
	const payload = await api.get<{
		by_folder_item_id?: Record<string, unknown>;
		per_folder_limit?: unknown;
	}>(
		`/content/folder-previews?${params.toString()}`,
		buildContentRequestConfig()
	);
	const raw = payload.by_folder_item_id ?? {};
	const by_folder_item_id: Record<
		string,
		Array<{ id: string; content_type: string; mime_type: string | null }>
	> = {};
	for (const [folderId, rows] of Object.entries(raw)) {
		if (!Array.isArray(rows)) continue;
		const mapped = rows
			.map((row) => {
				if (!row || typeof row !== 'object') return null;
				const rec = row as Record<string, unknown>;
				const id = typeof rec.id === 'string' ? rec.id : String(rec.id ?? '');
				if (!id) return null;
				return {
					id,
					content_type:
						typeof rec.content_type === 'string'
							? rec.content_type
							: String(rec.content_type ?? ''),
					mime_type:
						typeof rec.mime_type === 'string'
							? rec.mime_type
							: rec.mime_type == null
								? null
								: String(rec.mime_type),
				};
			})
			.filter(
				(
					row
				): row is {
					id: string;
					content_type: string;
					mime_type: string | null;
				} => row !== null
			);
		if (mapped.length > 0) {
			by_folder_item_id[folderId] = mapped;
		}
	}
	return {
		by_folder_item_id,
		per_folder_limit: Number(payload.per_folder_limit) || perFolderLimit,
	};
}

async function recordContentView(contentId: string): Promise<void> {
	await api.post(
		`/content/${contentId}/record-view`,
		{},
		buildContentRequestConfig()
	);
}

async function getViewHistory(
	limit = 50
): Promise<{ items: ContentViewHistoryApiItem[] }> {
	const payload = await api.get<{
		items?: Array<{
			content?: unknown;
			view_count?: unknown;
			last_viewed_at?: unknown;
		}>;
	}>('/content/view-history', {
		...buildContentRequestConfig(),
		params: { limit },
	});
	const rows = Array.isArray(payload.items) ? payload.items : [];
	return {
		items: rows.map((row) => ({
			content: normalizeContentItem(row.content),
			view_count: toNumberValue(row.view_count, 0),
			last_viewed_at:
				row.last_viewed_at == null ? null : String(row.last_viewed_at),
		})),
	};
}

async function clearViewHistory(): Promise<void> {
	await api.delete('/content/view-history', buildContentRequestConfig());
}

async function getManagerActivity(
	limit = 50
): Promise<{ items: ManagerActivityApiRow[] }> {
	const payload = await api.get<{ items?: unknown[] }>(
		'/content/manager/activity',
		{
			...buildContentRequestConfig(),
			params: { limit },
		}
	);
	const rows = Array.isArray(payload.items) ? payload.items : [];
	return {
		items: rows.map((r) => normalizeManagerActivityRow(r)),
	};
}

async function getQuotaMe(): Promise<{
	bytes_used: number;
	quota_bytes: number | null;
	bytes_remaining: number | null;
}> {
	const payload = await api.get<{
		bytes_used?: number;
		quota_bytes?: number | null;
		bytes_remaining?: number | null;
		storage_used_bytes?: number;
		storage_quota_bytes?: number | null;
		storage_remaining_bytes?: number | null;
	}>('/content/quota/me', buildContentRequestConfig());
	const bytesUsedRaw = payload.bytes_used ?? payload.storage_used_bytes ?? 0;
	const quotaBytesRaw =
		payload.quota_bytes ?? payload.storage_quota_bytes ?? null;
	const bytesRemainingRaw =
		payload.bytes_remaining ?? payload.storage_remaining_bytes ?? null;
	return {
		bytes_used: Number(bytesUsedRaw ?? 0),
		quota_bytes: quotaBytesRaw != null ? Number(quotaBytesRaw) : null,
		bytes_remaining:
			bytesRemainingRaw != null ? Number(bytesRemainingRaw) : null,
	};
}

async function getPopularTags(
	limit = 20,
	search?: string
): Promise<Array<{ tag: string; count: number }>> {
	const payload = await api.get<{
		tags?: Array<{ tag: string; count: number }>;
	}>('/content/tags/popular', {
		...buildContentRequestConfig(),
		params: toQueryParams({ limit, search }),
	});
	return Array.isArray(payload.tags) ? payload.tags : [];
}

async function searchContent(
	query: string,
	options: {
		limit?: number;
		offset?: number;
		mode?: 'keyword' | 'hybrid';
		content_type?: string;
		signal?: AbortSignal;
	} = {}
): Promise<ContentSearchResponse> {
	const payload = await api.get<ContentSearchApiPayload>('/content/search', {
		...buildContentRequestConfig({ signal: options.signal }),
		params: toQueryParams({
			q: query,
			limit: options.limit ?? 5,
			offset: options.offset ?? 0,
			mode: options.mode,
			content_type: options.content_type,
		}),
	});
	return normalizeSearchResponse(payload);
}

async function advancedSearch(
	params: ContentAdvancedSearchParams,
	config?: AxiosRequestConfig
): Promise<ContentSearchResponse> {
	const payload = await api.post<ContentSearchApiPayload>(
		'/content/search/advanced',
		params,
		buildContentRequestConfig(config)
	);
	return normalizeSearchResponse(payload);
}

async function suggestTags(
	prefix: string,
	options: { limit?: number; signal?: AbortSignal } = {}
): Promise<string[]> {
	const payload = await api.get<{ tags?: unknown[] }>('/content/tags/suggest', {
		...buildContentRequestConfig({ signal: options.signal }),
		params: toQueryParams({ prefix, limit: options.limit ?? 5 }),
	});
	return Array.isArray(payload.tags)
		? payload.tags.map((tag) => String(tag))
		: [];
}

async function getAutocompleteSuggestions(
	query: string,
	options: { limit?: number; signal?: AbortSignal } = {}
): Promise<ContentAutocompleteSuggestion[]> {
	const trimmed = query.trim();
	const tagSuggestPromise =
		trimmed.length > 0 && trimmed.length <= 50
			? suggestTags(trimmed, options)
			: Promise.resolve([] as string[]);

	const [searchResult, tagResult] = await Promise.allSettled([
		searchContent(query, options),
		tagSuggestPromise,
	]);

	const suggestions: ContentAutocompleteSuggestion[] = [];

	if (searchResult.status === 'fulfilled') {
		searchResult.value.results.forEach((item) => {
			suggestions.push({
				type: 'file',
				id: item.id,
				label: item.name,
				subtitle: item.content_type,
			});
		});
	}

	if (tagResult.status === 'fulfilled') {
		tagResult.value.forEach((tag) => {
			suggestions.push({
				type: 'tag',
				label: tag,
				subtitle: 'Тег',
			});
		});
	}

	return suggestions;
}

async function findDuplicates<T = unknown>(): Promise<T> {
	return api.get<T>('/content/duplicates', buildContentRequestConfig());
}

async function listBrokenContent(): Promise<BrokenContentListResponse> {
	return api.get('/content/broken', buildContentRequestConfig());
}

async function storageRecheck(
	contentId: string
): Promise<StorageRecheckResponse> {
	return api.post(
		`/content/${contentId}/storage-recheck`,
		{},
		buildContentRequestConfig()
	);
}

async function permanentDeleteContent(contentId: string): Promise<{
	content_id: string;
	deleted: boolean;
}> {
	return api.post(
		`/content/${contentId}/permanent-delete`,
		{},
		buildContentRequestConfig()
	);
}

export const listApi = {
	getFolderView,
	listContent,
	listContentMultiVersion,
	getContent,
	getCurrentUserId,
	getStats,
	getFolderTotals,
	getFolderPreviews,
	recordContentView,
	getViewHistory,
	clearViewHistory,
	getManagerActivity,
	getQuotaMe,
	getPopularTags,
	searchContent,
	advancedSearch,
	suggestTags,
	getAutocompleteSuggestions,
	findDuplicates,
	listBrokenContent,
	storageRecheck,
	permanentDeleteContent,
};
