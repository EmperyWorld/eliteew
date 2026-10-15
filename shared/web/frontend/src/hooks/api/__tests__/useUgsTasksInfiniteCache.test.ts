/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Focused pure-helper coverage for UGS infinite task cache page selection.
 *
 * Invariants:
 * - Non-zero offset merges compare against the cached page at the same offset.
 * - Flattening is centralized so render/poll paths share the same page order.
 * - Infinite cache retention has an explicit page cap and garbage-collection window.
 *
 * Related:
 * - src/hooks/api/useUgsTasksInfinite.ts
 */
import { describe, expect, it } from 'vitest';
import {
	flattenUgsTaskPages,
	resolveCachedUgsTaskPage,
	resolveUgsTasksNextPageParam,
	UGS_TASKS_INFINITE_GC_MS,
	UGS_TASKS_INFINITE_MAX_PAGES,
} from '../useUgsTasksInfinite';
import type { UGSTask } from '../../../services/api/ugs/types';

const task = (id: string): UGSTask => ({
	id,
	type_key: 'text_chat',
	status: 'completed',
	created_at: '2026-05-28T00:00:00Z',
	updated_at: '2026-05-28T00:00:00Z',
	user_id: 'u1',
	priority: 5,
});

describe('useUgsTasksInfinite cache helpers', () => {
	it('resolves the cached page at the same offset', () => {
		const pages = [
			[task('p0-a'), task('p0-b')],
			[task('p1-a'), task('p1-b')],
			[task('p2-a')],
		];

		expect(resolveCachedUgsTaskPage(pages, 2, 2).map((row) => row.id)).toEqual([
			'p1-a',
			'p1-b',
		]);
	});

	it('flattens pages in query order', () => {
		expect(
			flattenUgsTaskPages([[task('a')], [task('b'), task('c')]]).map(
				(row) => row.id
			)
		).toEqual(['a', 'b', 'c']);
	});

	it('caps next page resolution at the configured active page limit', () => {
		const fullPage = [task('a'), task('b')];
		const pages = Array.from(
			{ length: UGS_TASKS_INFINITE_MAX_PAGES },
			(_, i) => [task(`p${i}`), task(`p${i}-b`)]
		);

		expect(
			resolveUgsTasksNextPageParam(fullPage, pages, 14, 2)
		).toBeUndefined();
		expect(
			resolveUgsTasksNextPageParam(fullPage, pages.slice(0, -1), 12, 2)
		).toBe(14);
	});

	it('keeps an explicit gc window for bounded task history', () => {
		expect(UGS_TASKS_INFINITE_GC_MS).toBe(5 * 60 * 1000);
	});
});
