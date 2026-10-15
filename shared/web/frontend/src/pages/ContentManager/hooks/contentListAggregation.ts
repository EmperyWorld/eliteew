/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Aggregates paginated Unified Content list responses for the Content Manager all-files view.
 *
 * Invariants:
 * - Aggregation has an explicit item cap and reports truncation instead of silently walking huge libraries.
 * - Callers keep request freshness and AbortSignal ownership.
 *
 * Related:
 * - `useContentList.ts`
 * - `documentation/product/CONTENT-MANAGER.md`
 */
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import type { ContentListQuery } from '../../../services/contentApi';

/** Must stay within API `le=200` for GET /content list. */
export const CONTENT_LIST_AGGREGATE_CHUNK = 200;

/** Client-side guard for all-files mode; users can narrow with filters/search beyond this point. */
export const CONTENT_LIST_AGGREGATE_MAX_ITEMS = 10_000;

export interface AggregateContentListPagesOptions {
	buildQuery: (limit: number, offset: number) => ContentListQuery;
	fetchPage: (query: ContentListQuery) => Promise<ContentListPageResponse>;
	isCurrent: () => boolean;
	chunkSize?: number;
	maxItems?: number;
}

export interface ContentListPageResponse {
	items: ContentItem[];
	total: number;
}

export interface AggregateContentListPagesResult {
	items: ContentItem[];
	total: number;
	truncated: boolean;
}

export async function aggregateContentListPages({
	buildQuery,
	fetchPage,
	isCurrent,
	chunkSize = CONTENT_LIST_AGGREGATE_CHUNK,
	maxItems = CONTENT_LIST_AGGREGATE_MAX_ITEMS,
}: AggregateContentListPagesOptions): Promise<AggregateContentListPagesResult | null> {
	let offset = 0;
	const allItems: ContentItem[] = [];
	let total = 0;
	const safeChunkSize = Math.max(
		1,
		Math.min(chunkSize, CONTENT_LIST_AGGREGATE_CHUNK)
	);
	const safeMaxItems = Math.max(1, maxItems);

	while (allItems.length < safeMaxItems) {
		const limit = Math.min(safeChunkSize, safeMaxItems - allItems.length);
		const response = await fetchPage(buildQuery(limit, offset));
		if (!isCurrent()) return null;

		const batch = response.items ?? [];
		total =
			typeof response.total === 'number'
				? response.total
				: Math.max(total, offset + batch.length);
		allItems.push(...batch);

		if (
			batch.length === 0 ||
			batch.length < limit ||
			allItems.length >= total
		) {
			break;
		}
		offset += batch.length;
	}

	return {
		items: allItems,
		total,
		truncated: allItems.length < total,
	};
}
