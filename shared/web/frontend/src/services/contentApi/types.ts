/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public TypeScript contracts for Unified Content client API modules.
 *
 * Invariants:
 * - Shapes align with generated OpenAPI schemas where applicable.
 *
 * Related:
 * - src/generated/content-openapi.ts
 * - src/components/UnifiedContent/types.ts
 */
import type { components } from '@/generated/content-openapi';
import type { Content } from '../../components/UnifiedContent/types';

type UnknownRecord = Record<string, unknown>;

export interface ContentListQuery {
	limit?: number;
	offset?: number;
	/** Keyset cursor from prior `next_cursor`; mutually exclusive with offset>0 without search ranking. */
	cursor?: string;
	search?: string;
	content_type?: string;
	mime_type?: string;
	visibility?: string;
	folder_item_id?: string;
	/** Only items with folder_item_id IS NULL (desktop «без папки»). */
	folder_unassigned?: boolean;
	/** Исключить контент из указанной системной папки (item_id рабочего стола). */
	exclude_folder_item_id?: string;
	company_id?: string | null;
	project_id?: string | null;
	sort_field?: string;
	sort_order?: string;
	source_service?: string;
	/** Только объекты текущего пользователя (см. API `owner_only`). */
	owner_only?: boolean;
	/**
	 * `compact`: узкие элементы списка без тяжёлых полей (metadata, extracted_text, …).
	 * См. `GET /api/v1/content?list_profile=compact`.
	 */
	list_profile?: 'full' | 'compact';
	/** Comma-separated tag filter (matches GET /content?tags=). */
	tags?: string;
	/** Minimum file_size in bytes (inclusive). */
	min_file_size?: number;
	/** Filter by processing_status: pending, processing, completed, failed. */
	processing_status?: string;
}

export interface ContentListResult {
	items: Content[];
	total: number;
	page?: number;
	page_size?: number;
	has_more?: boolean;
	next_cursor?: string | null;
}

export type FolderViewDesktopChild =
	components['schemas']['FolderViewDesktopChild'];

export interface FolderViewQuery {
	folderItemId?: string;
	unfiled?: boolean;
	search?: string;
	sort?: {
		field?: 'name' | 'date' | 'modified' | 'size' | 'type';
		order?: 'asc' | 'desc';
	};
	limit?: number;
	offset?: number;
	contentType?: string;
	mimeType?: string;
	/** Minimum file_size in bytes (inclusive). */
	minFileSize?: number;
	/** Filter by processing_status: pending, processing, completed, failed. */
	processingStatus?: string;
}

export interface FolderViewResult {
	folder_item_id: string | null;
	unfiled: boolean;
	desktop_children: FolderViewDesktopChild[];
	files: ContentListResult & {
		page: number;
		page_size: number;
		has_more: boolean;
	};
}

/** GET /content/view-history */
export interface ContentViewHistoryApiItem {
	content: Content;
	view_count: number;
	last_viewed_at: string | null;
}

/** GET /content/manager/activity */
export interface ManagerActivityApiRow {
	id: string;
	content_id: string | null;
	action: string;
	details: Record<string, unknown> | null;
	created_at: string;
	content_name: string | null;
}

export interface ContentSearchResult {
	id: string;
	name: string;
	description?: string;
	content_type: string;
	tags: string[];
	created_at: string;
	score: number;
}

export interface ContentSearchResponse {
	total: number;
	results: ContentSearchResult[];
	took_ms: number;
	search_mode?: 'keyword' | 'hybrid';
}

/** Hit from POST /content/search/advanced — not a full Content row (no file_size, ACL, etc.). */
export type ContentAdvancedSearchHit = ContentSearchResult;

export interface ContentAdvancedSearchParams {
	query: string;
	content_types?: string[];
	tags?: string[];
	visibility?: string;
	date_from?: string;
	date_to?: string;
	file_size_min?: number;
	file_size_max?: number;
	limit?: number;
	offset?: number;
}

export interface ContentAutocompleteSuggestion {
	type: 'file' | 'tag';
	id?: string;
	label: string;
	subtitle?: string;
}

export interface ContentComment {
	id: string;
	text: string;
	user_id: string;
	created_at: string;
}

export type ContentCollectionStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface BlobDownloadResult {
	blob: Blob;
	filename?: string;
}

export interface ContentDownloadTicketResponse {
	download_url: string;
	expires_in_seconds: number;
}

/** Owner broken-files list item (GET /content/broken) — FE contract until OpenAPI pilots refresh. */
export interface BrokenContentItem {
	id: string;
	name?: string | null;
	title?: string | null;
	original_filename?: string | null;
	content_type?: string | null;
	mime_type?: string | null;
	file_size?: number | null;
	storage_broken_at?: string | null;
	storage_broken_reason?: string | null;
	storage_last_checked_at?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface BrokenContentListResponse {
	total: number;
	items: BrokenContentItem[];
	limit: number;
	offset: number;
}

export interface StorageRecheckResponse {
	content_id: string;
	ok: boolean;
	storage_integrity_status: string;
}

export interface ContentDownloadToBrowserOptions {
	contentId: string;
	preferredFilename?: string | null;
	revision?: string | null;
	disposition?: 'attachment' | 'inline';
	directTicket?: string | null;
}

export interface VersionDownloadToBrowserOptions {
	versionId: string;
	fallbackFilename?: string | null;
	directTicket?: string | null;
}

export interface BatchDownloadToBrowserOptions {
	contentIds: string[];
	archiveName?: string | null;
	directTicket?: string | null;
}

export interface OwnedArchiveDownloadToBrowserOptions {
	archiveName?: string | null;
	directTicket?: string | null;
}

export type ContentListApiPayload =
	components['schemas']['ContentListResponse'];
export type ContentItemApiPayload = components['schemas']['Content'];
export type FolderViewApiPayload = components['schemas']['FolderViewResponse'];
export type ContentSearchApiPayload = components['schemas']['SearchResponse'];
export type ContentDownloadTicketApiPayload =
	components['schemas']['ContentDownloadTicketResponse'];
export type ContentShareApiPayload = components['schemas']['Share'];
export type ContentShareResponseApiPayload =
	components['schemas']['ShareResponse'];
export type ContentVersionListApiPayload =
	components['schemas']['VersionListResponse'];
export type ContentVersionApiPayload = components['schemas']['VersionResponse'];

export type { UnknownRecord };
