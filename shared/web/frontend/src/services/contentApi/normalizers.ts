/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Response normalizers mapping Unified Content API payloads to SPA domain types.
 *
 * Invariants:
 * - Normalizers tolerate legacy field aliases without changing public Content shape.
 *
 * Related:
 * - src/components/UnifiedContent/types.ts
 */
import type {
	Content,
	Share,
	ShareResponse,
	Version,
} from '../../components/UnifiedContent/types';
import type {
	ContentComment,
	ContentListResult,
	ContentSearchResponse,
	FolderViewApiPayload,
	FolderViewResult,
	ManagerActivityApiRow,
} from './types';
import {
	buildContentDownloadUrl,
	isRecord,
	toBooleanValue,
	toNullableString,
	toNumberValue,
	toStringArray,
	toStringValue,
} from './utils';

export function normalizeManagerActivityRow(
	raw: unknown
): ManagerActivityApiRow {
	const rec = isRecord(raw) ? raw : {};
	return {
		id: toStringValue(rec.id),
		content_id:
			rec.content_id == null || rec.content_id === ''
				? null
				: String(rec.content_id),
		action: toStringValue(rec.action),
		details: isRecord(rec.details) ? rec.details : null,
		created_at: toStringValue(rec.created_at),
		content_name:
			rec.content_name == null || rec.content_name === ''
				? null
				: String(rec.content_name),
	};
}

export function normalizeContentItem(raw: unknown): Content {
	const record = isRecord(raw) ? raw : {};
	const id = toStringValue(record.id ?? record.content_id);
	const name = toStringValue(
		record.name ?? record.filename ?? record.title,
		'Без названия'
	);
	const fileSizeValue = record.file_size ?? record.size;
	const contentType = toStringValue(
		record.content_type ?? record.mime_type,
		'other'
	);
	const mimeType = toNullableString(
		record.mime_type ?? (contentType.includes('/') ? contentType : null)
	);

	return {
		id,
		name,
		content_type: contentType,
		file_size: fileSizeValue == null ? null : toNumberValue(fileSizeValue),
		mime_type: mimeType,
		created_at: toStringValue(
			record.created_at ?? record.uploaded_at,
			new Date(0).toISOString()
		),
		updated_at: toStringValue(
			record.updated_at ?? record.modified_at ?? record.created_at,
			new Date(0).toISOString()
		),
		user_id: toStringValue(record.user_id ?? record.owner_id),
		thumbnail_url: toNullableString(record.thumbnail_url),
		thumbnail_path: toNullableString(record.thumbnail_path),
		visibility: toStringValue(record.visibility, 'private'),
		tags: toStringArray(record.tags),
		processing_status: toNullableString(record.processing_status) ?? undefined,
		processing_error: toNullableString(record.processing_error) ?? undefined,
		description: toNullableString(record.description) ?? undefined,
		company_id: toNullableString(record.company_id),
		project_id: toNullableString(record.project_id),
		friend_visibility: toBooleanValue(record.friend_visibility),
		shared_with_user_ids: toStringArray(record.shared_with_user_ids),
		extracted_text: toNullableString(record.extracted_text),
		metadata: isRecord(record.metadata) ? record.metadata : undefined,
		file_path: toNullableString(record.file_path),
		file_hash: toNullableString(record.file_hash),
		original_filename: toNullableString(record.original_filename),
		folder_item_id: toNullableString(record.folder_item_id),
		is_owner:
			typeof record.is_owner === 'boolean' ? record.is_owner : undefined,
		can_edit:
			typeof record.can_edit === 'boolean' ? record.can_edit : undefined,
		can_delete:
			typeof record.can_delete === 'boolean' ? record.can_delete : undefined,
		version_snapshot_count:
			typeof record.version_snapshot_count === 'number'
				? record.version_snapshot_count
				: undefined,
		deduplicated_reused:
			typeof record.deduplicated_reused === 'boolean'
				? record.deduplicated_reused
				: undefined,
	};
}

export function withContentDownloadUrl(
	content: Content
): Content & { file_url: string } {
	return {
		...content,
		file_url: buildContentDownloadUrl(content.id),
	};
}

export function normalizeContentListResponse(
	payload: unknown
): ContentListResult {
	if (Array.isArray(payload)) {
		const items = payload.map(normalizeContentItem);
		return { items, total: items.length };
	}

	if (isRecord(payload) && Array.isArray(payload.items)) {
		const items = payload.items.map(normalizeContentItem);
		const total =
			typeof payload.total === 'number' ? payload.total : items.length;
		return {
			items,
			total,
			page: typeof payload.page === 'number' ? payload.page : undefined,
			page_size:
				typeof payload.page_size === 'number' ? payload.page_size : undefined,
			has_more:
				typeof payload.has_more === 'boolean' ? payload.has_more : undefined,
			next_cursor:
				typeof payload.next_cursor === 'string'
					? payload.next_cursor
					: payload.next_cursor === null
						? null
						: undefined,
		};
	}

	if (isRecord(payload) && isRecord(payload.data)) {
		const inner = payload.data;
		if (Array.isArray(inner.items)) {
			const items = inner.items.map(normalizeContentItem);
			const total =
				typeof inner.total === 'number' ? inner.total : items.length;
			return { items, total };
		}
	}

	return { items: [], total: 0 };
}

export function normalizeFolderViewResponse(
	payload: FolderViewApiPayload
): FolderViewResult {
	return {
		folder_item_id: payload.folder_item_id,
		unfiled: payload.unfiled,
		desktop_children: payload.desktop_children,
		files: {
			...normalizeContentListResponse(payload.files),
			page: payload.files.page,
			page_size: payload.files.page_size,
			has_more: payload.files.has_more,
		},
	};
}

export function normalizeContentComments(payload: unknown): ContentComment[] {
	if (!Array.isArray(payload)) {
		return [];
	}

	return payload
		.map((comment) => {
			const record = isRecord(comment) ? comment : {};
			return {
				id: toStringValue(record.id),
				text: toStringValue(record.text),
				user_id: toStringValue(record.user_id),
				created_at: toStringValue(record.created_at, new Date(0).toISOString()),
			};
		})
		.filter((comment) => comment.id !== '' && comment.text.trim() !== '');
}

export function extractContentComments(
	content: Content | null | undefined
): ContentComment[] {
	if (!content || !isRecord(content.metadata)) {
		return [];
	}
	return normalizeContentComments(content.metadata.comments);
}

export function normalizeVersionItem(raw: unknown): Version {
	const record = isRecord(raw) ? raw : {};
	return {
		version_id: toStringValue(record.version_id ?? record.id),
		content_id: toNullableString(record.content_id) ?? undefined,
		version_number: toNumberValue(record.version_number ?? record.version),
		file_size: toNumberValue(record.file_size),
		file_hash: toNullableString(record.file_hash) ?? undefined,
		mime_type: toNullableString(record.mime_type) ?? undefined,
		name: toNullableString(record.name) ?? undefined,
		description: toNullableString(record.description) ?? undefined,
		tags: toStringArray(record.tags),
		metadata: isRecord(record.metadata) ? record.metadata : undefined,
		created_by: toStringValue(record.created_by),
		created_at: toStringValue(record.created_at, new Date(0).toISOString()),
		change_description:
			toNullableString(
				record.change_description ?? record.changes_description
			) ?? undefined,
		updated_by: toNullableString(record.updated_by) ?? undefined,
		updated_by_username:
			toNullableString(record.updated_by_username) ?? undefined,
		created_by_username:
			toNullableString(record.created_by_username) ?? undefined,
	};
}

export function normalizeVersionList(payload: unknown): Version[] {
	if (Array.isArray(payload)) {
		return payload.map(normalizeVersionItem);
	}
	if (isRecord(payload) && Array.isArray(payload.versions)) {
		return payload.versions.map(normalizeVersionItem);
	}
	return [];
}

export function normalizeShareItem(raw: unknown): Share {
	const record = isRecord(raw) ? raw : {};
	const sharedBy = toStringValue(record.shared_by ?? record.shared_by_user_id);
	const sharedWith =
		toNullableString(record.shared_with ?? record.shared_with_user_id) ??
		undefined;
	const permission = toStringValue(
		record.permission_level ?? record.permission,
		'view'
	);

	return {
		id: toStringValue(record.id),
		content_id: toStringValue(record.content_id),
		shared_by: sharedBy,
		shared_with: sharedWith,
		permission_level: permission,
		expires_at: toNullableString(record.expires_at) ?? undefined,
		created_at: toStringValue(record.created_at, new Date(0).toISOString()),
		accessed_at: toNullableString(record.accessed_at) ?? undefined,
		access_count: toNumberValue(record.access_count),
		shared_by_user_id: sharedBy,
		shared_with_user_id: sharedWith,
		permission,
	};
}

export function normalizeShareResponseItem(raw: unknown): ShareResponse {
	const baseShare = normalizeShareItem(raw);
	const record = isRecord(raw) ? raw : {};
	return {
		...baseShare,
		content_name: toNullableString(record.content_name) ?? undefined,
		content_type: toNullableString(record.content_type) ?? undefined,
	};
}

export function normalizeSearchResponse(
	payload: unknown
): ContentSearchResponse {
	const record = isRecord(payload) ? payload : {};
	const rawResults = Array.isArray(record.results) ? record.results : [];
	const results = rawResults.map((result) => {
		const item = isRecord(result) ? result : {};
		return {
			id: toStringValue(item.id),
			name: toStringValue(item.name, 'Без названия'),
			description: toNullableString(item.description) ?? undefined,
			content_type: toStringValue(item.content_type, 'other'),
			tags: toStringArray(item.tags),
			created_at: toStringValue(item.created_at, new Date(0).toISOString()),
			score: toNumberValue(item.score),
		};
	});

	return {
		total: typeof record.total === 'number' ? record.total : results.length,
		results,
		took_ms: toNumberValue(record.took_ms),
		search_mode:
			record.search_mode === 'hybrid' || record.search_mode === 'keyword'
				? record.search_mode
				: undefined,
	};
}
