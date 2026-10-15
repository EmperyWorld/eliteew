/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Warm adjacent Content Manager preview blobs while the preview modal is open.
 *
 * Invariants:
 * - Prefetch is best-effort; failures are ignored and never surface to the user.
 * - In-flight keys dedupe parallel downloads for the same content revision.
 *
 * Related:
 * - ContentManagerPro.tsx, ContentManagerPreviewModal.tsx
 */
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import {
	buildContentBlobCacheRevision,
	contentApi,
} from '../../../services/contentApi';
import { isTextLikeContent } from './contentManagerTextLike';

const inflight = new Map<string, Promise<void>>();

function cacheKey(contentId: string, revision: string | null): string {
	return `${contentId}::${revision ?? ''}`;
}

export function prefetchContentPreviewBlob(item: ContentItem): void {
	if (isTextLikeContent(item)) {
		return;
	}
	const revision = buildContentBlobCacheRevision(item);
	const key = cacheKey(item.id, revision);
	if (inflight.has(key)) {
		return;
	}
	const task = contentApi
		.downloadContentBlob(item.id, revision)
		.then(() => undefined)
		.catch(() => undefined)
		.finally(() => {
			inflight.delete(key);
		});
	inflight.set(key, task);
}

export function prefetchAdjacentContentPreviews(
	items: readonly ContentItem[],
	current: ContentItem | null
): void {
	if (!current || items.length === 0) {
		return;
	}
	const idx = items.findIndex((row) => row.id === current.id);
	if (idx < 0) {
		return;
	}
	const previous = idx > 0 ? items[idx - 1] : null;
	const next = idx < items.length - 1 ? items[idx + 1] : null;
	if (previous) {
		prefetchContentPreviewBlob(previous);
	}
	if (next) {
		prefetchContentPreviewBlob(next);
	}
}
