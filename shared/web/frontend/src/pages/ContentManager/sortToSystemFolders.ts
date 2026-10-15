/**
 * Auto-move unified content into desktop system folders by content_type.
 * Folder item_ids match api/routers/desktop.py SYSTEM_FOLDER_KEYS (item_id on desktop_items).
 */

import type { Content } from '../../components/UnifiedContent/types';
import { buildContentFolderScopePatch } from '../Desktop/utils/desktopFileContentFolderScope';
import { contentApi } from '../../services/contentApi';
import authSession from '../../services/authSession';

const PAGE_SIZE = 200;
/** Proactively refresh access token during long PATCH chains (avoids 401 / apparent "disconnect") */
const KEYCLOAK_REFRESH_EVERY_N_PATCHES = 15;

/** Desktop system folder item_id values */
export const SYSTEM_FOLDER_ITEM = {
	documents: 'documents',
	images: 'images',
	projects: 'projects',
	music: 'music',
	downloads: 'downloads',
	content: 'content',
	ewa_file: 'ewa_file',
} as const;

export type AutoSortScope = 'unfiled' | 'content_folder';

/**
 * Map API content_type to system folder item_id.
 */
export function targetSystemFolderItemId(contentType: string): string {
	const t = (contentType || '').toLowerCase().trim();
	switch (t) {
		case 'document':
		case 'presentation':
		case 'spreadsheet':
			return SYSTEM_FOLDER_ITEM.documents;
		case 'image':
			return SYSTEM_FOLDER_ITEM.images;
		case 'audio':
			return SYSTEM_FOLDER_ITEM.music;
		case 'video':
			return SYSTEM_FOLDER_ITEM.downloads;
		// ai_result, other → default bucket
		default:
			return SYSTEM_FOLDER_ITEM.content;
	}
}

export async function fetchAllForAutoSort(
	scope: AutoSortScope,
	config?: { signal?: AbortSignal }
): Promise<Content[]> {
	const out: Content[] = [];
	let offset = 0;
	const base = {
		limit: PAGE_SIZE,
		sort_field: 'date' as const,
		sort_order: 'desc' as const,
		list_profile: 'compact' as const,
		signal: config?.signal,
	};
	for (;;) {
		const params =
			scope === 'unfiled'
				? { ...base, folder_unassigned: true, offset }
				: { ...base, folder_item_id: SYSTEM_FOLDER_ITEM.content, offset };
		const res = await contentApi.listContent(params);
		const batch = res.items ?? [];
		out.push(...batch);
		if (batch.length < PAGE_SIZE) break;
		offset += PAGE_SIZE;
	}
	return out;
}

export interface AutoSortResult {
	moved: number;
	skipped: number;
	/** PATCH would return 403 — not owner (e.g. shared / friends library) */
	skippedNoPermission: number;
	errors: number;
}

/**
 * Update each item's folder_item_id when it differs from the target for its type.
 */
export async function applyAutoSortToSystemFolders(
	items: readonly Content[],
	scope: AutoSortScope,
	options?: {
		onProgress?: (done: number, total: number) => void;
		signal?: AbortSignal;
	}
): Promise<AutoSortResult> {
	let moved = 0;
	let skipped = 0;
	let skippedNoPermission = 0;
	let errors = 0;
	let patchesSinceRefresh = 0;
	const total = items.length;
	let done = 0;
	const report = () => {
		done += 1;
		options?.onProgress?.(done, total);
	};

	const ensureFreshTokenIfNeeded = async () => {
		if (!authSession.authenticated) return;
		patchesSinceRefresh += 1;
		if (patchesSinceRefresh < KEYCLOAK_REFRESH_EVERY_N_PATCHES) return;
		patchesSinceRefresh = 0;
		try {
			await authSession.updateToken(120);
		} catch {
			/* next request will use axios 401 retry path */
		}
	};

	for (const item of items) {
		if (options?.signal?.aborted) break;

		/* List can include shared / non-owned rows; PATCH is owner-only on API */
		if (item.is_owner === false || item.can_edit === false) {
			skippedNoPermission += 1;
			skipped += 1;
			report();
			continue;
		}

		const target = targetSystemFolderItemId(item.content_type);
		const currentRaw = item.folder_item_id;
		const current =
			currentRaw != null && String(currentRaw).trim() !== ''
				? String(currentRaw).trim()
				: null;

		if (scope === 'unfiled') {
			if (current !== null) {
				skipped += 1;
				report();
				continue;
			}
		} else if (current !== SYSTEM_FOLDER_ITEM.content) {
			skipped += 1;
			report();
			continue;
		}

		if (target === current) {
			skipped += 1;
			report();
			continue;
		}

		try {
			await ensureFreshTokenIfNeeded();
			await contentApi.updateContent(
				item.id,
				buildContentFolderScopePatch(target)
			);
			moved += 1;
		} catch {
			errors += 1;
		}
		report();
	}

	return { moved, skipped, skippedNoPermission, errors };
}
