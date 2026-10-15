/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests cursor-paged all-files hook merge and pagination flags.
 *
 * Invariants:
 * - Write-only in CI task; run locally with vitest on this file.
 *
 * Related:
 * - useContentManagerAllFilesQuery.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';

vi.mock('../../../services/contentApi', () => ({
	contentApi: {
		listContent: vi.fn(),
		searchContent: vi.fn(),
	},
	getContentCollectionStatus: (
		items: ContentItem[],
		loading: boolean,
		error: string | null
	) => {
		if (loading) return 'loading';
		if (error) return 'error';
		if (items.length === 0) return 'empty';
		return 'ready';
	},
	toContentError: (_err: unknown, fallback: string) => fallback,
}));

import { contentApi } from '../../../services/contentApi';
import {
	ALL_FILES_LIST_PAGE_SIZE,
	useContentManagerAllFilesQuery,
} from './useContentManagerAllFilesQuery';
import { renderHook, waitFor } from '@testing-library/react';

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

describe('useContentManagerAllFilesQuery', () => {
	beforeEach(() => {
		vi.mocked(contentApi.listContent).mockReset();
		vi.mocked(contentApi.searchContent).mockReset();
	});

	it('loads first page and exposes next_cursor hasMore', async () => {
		vi.mocked(contentApi.listContent).mockResolvedValue({
			items: [item('a'), item('b')],
			total: 10,
			has_more: true,
			next_cursor: 'cursor-1',
		});

		const { result } = renderHook(() =>
			useContentManagerAllFilesQuery({
				filterCompanyId: null,
				filterProjectId: null,
				debouncedSearchQuery: '',
				filterType: 'all',
				filterVisibility: 'all',
				sortField: 'updated_at',
				sortOrder: 'desc',
			})
		);

		await waitFor(
			() => {
				expect(result.current.loading).toBe(false);
				expect(result.current.items.map((row) => row.id)).toEqual(['a', 'b']);
			},
			{ timeout: 3000 }
		);
		expect(result.current.totalItems).toBe(10);
		expect(result.current.hasMore).toBe(true);
		expect(contentApi.listContent).toHaveBeenCalledWith(
			expect.objectContaining({
				limit: ALL_FILES_LIST_PAGE_SIZE,
				list_profile: 'compact',
			}),
			expect.any(Object)
		);
	});

	it('appends next page on loadMore', async () => {
		vi.mocked(contentApi.listContent).mockImplementation(async (query) => {
			if (query?.cursor) {
				return {
					items: [item('b')],
					total: 3,
					has_more: true,
					next_cursor: 'cursor-2',
				};
			}
			return {
				items: [item('a')],
				total: 3,
				has_more: true,
				next_cursor: 'cursor-1',
			};
		});

		const { result } = renderHook(() =>
			useContentManagerAllFilesQuery({
				filterCompanyId: null,
				filterProjectId: null,
				debouncedSearchQuery: '',
				filterType: 'all',
				filterVisibility: 'all',
				sortField: 'updated_at',
				sortOrder: 'desc',
			})
		);

		await waitFor(
			() => {
				expect(result.current.loading).toBe(false);
				expect(result.current.hasMore).toBe(true);
				expect(result.current.items.map((row) => row.id)).toEqual(['a']);
			},
			{ timeout: 3000 }
		);
		await result.current.loadMore();
		await waitFor(
			() => {
				expect(result.current.loadingMore).toBe(false);
				expect(result.current.items.map((row) => row.id)).toEqual(['a', 'b']);
			},
			{ timeout: 3000 }
		);
		expect(contentApi.listContent).toHaveBeenLastCalledWith(
			expect.objectContaining({ cursor: 'cursor-1' }),
			expect.any(Object)
		);
	});

	it('sends min_file_size and processing_status on list query', async () => {
		vi.mocked(contentApi.listContent).mockResolvedValue({
			items: [item('a')],
			total: 1,
			has_more: false,
			next_cursor: null,
		});

		renderHook(() =>
			useContentManagerAllFilesQuery({
				filterCompanyId: null,
				filterProjectId: null,
				debouncedSearchQuery: '',
				filterType: 'all',
				filterVisibility: 'all',
				sortField: 'updated_at',
				sortOrder: 'desc',
				minFileSize: 1_048_576,
				processingStatus: 'failed',
			})
		);

		await waitFor(() => {
			expect(contentApi.listContent).toHaveBeenCalled();
		});
		expect(contentApi.listContent).toHaveBeenCalledWith(
			expect.objectContaining({
				min_file_size: 1_048_576,
				processing_status: 'failed',
			}),
			expect.anything()
		);
	});
});
