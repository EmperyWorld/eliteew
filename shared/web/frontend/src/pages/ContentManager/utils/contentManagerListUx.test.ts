/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Tests Content Manager list UX resolvers for filters and selection copy.
 *
 * Invariants:
 * - Explorer folder navigation must not turn an empty folder into a filtered empty state.
 *
 * Related:
 * - `contentManagerListUx.ts`
 */
import { describe, expect, it } from 'vitest';
import {
	hasContentManagerActiveListFilters,
	resolveContentManagerSelectionCopy,
} from './contentManagerListUx';

describe('hasContentManagerActiveListFilters', () => {
	const base = {
		searchQuery: '',
		filterType: 'all',
		filterVisibility: 'all' as const,
		filesBrowseMode: 'explorer' as const,
		filterFolderId: null,
		filterCompanyId: null,
		filterProjectId: null,
	};

	it('does not treat explorer folder navigation as an active filter', () => {
		expect(hasContentManagerActiveListFilters(base)).toBe(false);
	});

	it('detects real refinements inside explorer mode', () => {
		expect(
			hasContentManagerActiveListFilters({
				...base,
				searchQuery: 'brief',
			})
		).toBe(true);
	});

	it('detects catalog folder filtering', () => {
		expect(
			hasContentManagerActiveListFilters({
				...base,
				filesBrowseMode: 'catalog',
				filterFolderId: 'folder-1',
			})
		).toBe(true);
	});
});

describe('resolveContentManagerSelectionCopy', () => {
	it('uses page copy for ungrouped paginated views', () => {
		expect(resolveContentManagerSelectionCopy('catalog', 'none')).toMatchObject(
			{
				selectAllKey: 'files.selection.selectAll',
				bulkHintKey: 'files.selection.bulkHint',
			}
		);
	});

	it('uses visible-scope copy for all-files and grouped views', () => {
		expect(
			resolveContentManagerSelectionCopy('all_files', 'folder')
		).toMatchObject({
			selectAllKey: 'files.selection.selectAllVisible',
			bulkHintKey: 'files.selection.bulkHintVisible',
		});
		expect(
			resolveContentManagerSelectionCopy('explorer', 'type')
		).toMatchObject({
			selectAllKey: 'files.selection.selectAllVisible',
		});
	});
});
