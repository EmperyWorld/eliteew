/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Tests bounded aggregation for the Content Manager all-files list.
 *
 * Invariants:
 * - Aggregation reports truncation instead of silently hiding an item cap.
 *
 * Related:
 * - `contentListAggregation.ts`
 */
import { describe, expect, it, vi } from 'vitest';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import type { ContentListQuery } from '../../../services/contentApi';
import { aggregateContentListPages } from './contentListAggregation';

function item(id: string): ContentItem {
	return {
		id,
		name: id,
		content_type: 'document',
		file_size: 0,
		mime_type: null,
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
		user_id: 'u',
		visibility: 'private',
		tags: [],
	} as ContentItem;
}

describe('aggregateContentListPages', () => {
	it('loads pages until total is reached', async () => {
		const rows = [item('a'), item('b'), item('c')];
		const fetchPage = vi.fn(async (query: ContentListQuery) => {
			const offset = Number(query.offset ?? 0);
			const limit = Number(query.limit ?? 2);
			return { items: rows.slice(offset, offset + limit), total: rows.length };
		});

		const result = await aggregateContentListPages({
			buildQuery: (limit, offset) => ({ limit, offset }),
			fetchPage,
			isCurrent: () => true,
			chunkSize: 2,
			maxItems: 10,
		});

		expect(result?.items.map((row) => row.id)).toEqual(['a', 'b', 'c']);
		expect(result?.truncated).toBe(false);
		expect(fetchPage).toHaveBeenCalledTimes(2);
	});

	it('reports truncation when maxItems cuts the list', async () => {
		const rows = [item('a'), item('b'), item('c'), item('d'), item('e')];
		const fetchPage = vi.fn(async (query: ContentListQuery) => {
			const offset = Number(query.offset ?? 0);
			const limit = Number(query.limit ?? 2);
			return { items: rows.slice(offset, offset + limit), total: rows.length };
		});

		const result = await aggregateContentListPages({
			buildQuery: (limit, offset) => ({ limit, offset }),
			fetchPage,
			isCurrent: () => true,
			chunkSize: 2,
			maxItems: 3,
		});

		expect(result?.items.map((row) => row.id)).toEqual(['a', 'b', 'c']);
		expect(result?.total).toBe(5);
		expect(result?.truncated).toBe(true);
	});

	it('returns null when the caller marks the request stale', async () => {
		const fetchPage = vi.fn(async () => ({ items: [item('a')], total: 1 }));

		const result = await aggregateContentListPages({
			buildQuery: (limit, offset) => ({ limit, offset }),
			fetchPage,
			isCurrent: () => false,
		});

		expect(result).toBeNull();
	});
});
