/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk company news types, React Query keys, and user/admin HTTP client for `/news`.
 *
 * Invariants:
 * - Published list responses normalize empty `items` and numeric `total`.
 *
 * Related:
 * - `shared/api/routers/product_desktop.py`
 * - `services/productDesktopApi/constants.ts`
 */

import type { components } from '@/generated/product-desktop-openapi';
import { api } from '../../../../services/api/client';
import { PRODUCT_DESKTOP_API_BASE } from './constants';

const BASE = PRODUCT_DESKTOP_API_BASE;

export type CompanyNewsPost = components['schemas']['CompanyNewsPostOut'];
/** List row from GET /news (body omitted; excerpt for list preview). */
export type CompanyNewsPostListItem =
	components['schemas']['CompanyNewsPostListItemOut'];

export type CompanyNewsPostListPage = {
	items: CompanyNewsPostListItem[];
	total: number;
	limit: number;
	offset: number;
	next_cursor?: string | null;
};

export type EwDeskNewsFeedFilters = {
	q?: string;
	pinnedOnly?: boolean;
	unreadOnly?: boolean;
	starredOnly?: boolean;
	sort?: 'newest' | 'oldest';
};

function normalizeEwDeskNewsFeedFilters(
	filters: EwDeskNewsFeedFilters = {}
): EwDeskNewsFeedFilters {
	const q = filters.q?.trim();
	return {
		...(q ? { q } : {}),
		...(filters.pinnedOnly ? { pinnedOnly: true } : {}),
		...(filters.unreadOnly ? { unreadOnly: true } : {}),
		...(filters.starredOnly ? { starredOnly: true } : {}),
		...(filters.sort === 'oldest' ? { sort: 'oldest' as const } : {}),
	};
}

export type CompanyNewsPostAdmin =
	components['schemas']['CompanyNewsPostAdminOut'];

export type EwDeskNewsUserState = {
	read_post_ids: string[];
	starred_post_ids: string[];
	last_seen_published_at?: string | null;
};

export type EwDeskNewsCounts = {
	unread_count: number;
	starred_count: number;
	pinned_count: number;
	total_published: number;
	latest_published_at?: string | null;
};

export type EwDeskNewsPolishResult = {
	body: string;
	title?: string | null;
};

export const EWDESK_WIDGET_PREVIEW_LIMIT_FULL = 4;
export const EWDESK_WIDGET_PREVIEW_LIMIT_COMPACT = 2;

export async function fetchPublishedNewsPage(opts?: {
	q?: string;
	limit?: number;
	offset?: number;
	cursor?: string;
	pinnedOnly?: boolean;
	unreadOnly?: boolean;
	starredOnly?: boolean;
	sort?: 'newest' | 'oldest';
}): Promise<CompanyNewsPostListPage> {
	const params = new URLSearchParams();
	const trimmed = opts?.q?.trim();
	if (trimmed) params.set('q', trimmed);
	if (opts?.limit != null) params.set('limit', String(opts.limit));
	if (opts?.cursor) {
		params.set('cursor', opts.cursor);
	} else if (opts?.offset != null) {
		params.set('offset', String(opts.offset));
	}
	if (opts?.pinnedOnly) params.set('pinned_only', 'true');
	if (opts?.unreadOnly) params.set('unread_only', 'true');
	if (opts?.starredOnly) params.set('starred_only', 'true');
	if (opts?.sort === 'oldest') params.set('sort', 'oldest');
	const qs = params.toString();
	const url = qs ? `${BASE}/news?${qs}` : `${BASE}/news`;
	const data = await api.get<CompanyNewsPostListPage>(url);
	return {
		items: data?.items ?? [],
		total: data?.total ?? 0,
		limit: data?.limit ?? opts?.limit ?? 50,
		offset: data?.offset ?? opts?.offset ?? 0,
		next_cursor: data?.next_cursor ?? null,
	};
}

export function ewDeskNewsWidgetPreviewQueryKey(
	limit: number
): readonly ['product-desktop', 'news', 'widget-preview', number] {
	return ['product-desktop', 'news', 'widget-preview', limit] as const;
}

export async function fetchEwDeskNewsWidgetPreview(
	limit: number
): Promise<CompanyNewsPostListItem[]> {
	const page = await fetchPublishedNewsPage({ limit, offset: 0 });
	return page.items;
}

export function ewDeskNewsPagedQueryKey(
	filters: EwDeskNewsFeedFilters = {}
):
	| readonly ['product-desktop', 'news', 'paged']
	| readonly ['product-desktop', 'news', 'paged', EwDeskNewsFeedFilters] {
	const normalized = normalizeEwDeskNewsFeedFilters(filters);
	if (Object.keys(normalized).length === 0) {
		return ['product-desktop', 'news', 'paged'] as const;
	}
	return ['product-desktop', 'news', 'paged', normalized] as const;
}

export async function fetchNewsPost(id: string): Promise<CompanyNewsPost> {
	return api.get<components['schemas']['CompanyNewsPostOut']>(
		`${BASE}/news/${id}`
	);
}

export async function fetchEwDeskNewsUserState(): Promise<EwDeskNewsUserState> {
	const data = await api.get<EwDeskNewsUserState>(`${BASE}/news/my-state`);
	return {
		read_post_ids: data?.read_post_ids ?? [],
		starred_post_ids: data?.starred_post_ids ?? [],
		last_seen_published_at: data?.last_seen_published_at ?? null,
	};
}

export async function patchEwDeskNewsUserState(body: {
	read_post_ids?: string[];
	starred_post_ids?: string[];
	mark_read_ids?: string[];
	mark_unread_ids?: string[];
	last_seen_published_at?: string | null;
}): Promise<EwDeskNewsUserState> {
	return api.patch<EwDeskNewsUserState>(`${BASE}/news/my-state`, body);
}

export async function fetchEwDeskNewsCounts(): Promise<EwDeskNewsCounts> {
	const data = await api.get<EwDeskNewsCounts>(`${BASE}/news/counts`);
	return {
		unread_count: data?.unread_count ?? 0,
		starred_count: data?.starred_count ?? 0,
		pinned_count: data?.pinned_count ?? 0,
		total_published: data?.total_published ?? 0,
		latest_published_at: data?.latest_published_at ?? null,
	};
}

export async function adminListNews(): Promise<CompanyNewsPostAdmin[]> {
	const data = await api.get<
		components['schemas']['CompanyNewsPostAdminOut'][]
	>(`${BASE}/admin/news`);
	return data ?? [];
}

export async function adminCreateNews(body: {
	title: string;
	body: string;
	image_url?: string | null;
	image_content_id?: string | null;
	video_content_id?: string | null;
	audio_content_id?: string | null;
	pinned?: boolean;
	is_published?: boolean;
	published_at?: string | null;
}): Promise<CompanyNewsPostAdmin> {
	return api.post<CompanyNewsPostAdmin>(`${BASE}/admin/news`, body);
}

export async function adminUpdateNews(
	id: string,
	body: Partial<{
		title: string;
		body: string;
		image_url: string | null;
		image_content_id: string | null;
		video_content_id: string | null;
		audio_content_id: string | null;
		pinned: boolean;
		is_published: boolean;
		published_at: string | null;
	}>
): Promise<CompanyNewsPostAdmin> {
	return api.patch<CompanyNewsPostAdmin>(`${BASE}/admin/news/${id}`, body);
}

export async function adminDeleteNews(id: string): Promise<void> {
	await api.delete(`${BASE}/admin/news/${id}`);
}

/** POST — rewrite draft into Markdown via UGS (admin). */
export async function adminPolishNewsBody(payload: {
	title?: string | null;
	body: string;
}): Promise<EwDeskNewsPolishResult> {
	return api.post<EwDeskNewsPolishResult>(`${BASE}/admin/news/polish-body`, {
		title: payload.title?.trim() ? payload.title.trim() : undefined,
		body: payload.body,
	});
}
