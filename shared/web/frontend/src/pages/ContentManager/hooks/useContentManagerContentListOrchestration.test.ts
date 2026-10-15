/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock for Content Manager list orchestration: explorer wires useFolderView with TanStack auto-fetch.
 *
 * Invariants:
 * - Default explorer browse mode enables useFolderView with auto=true.
 *
 * Related:
 * - useContentManagerContentListOrchestration.ts
 * - useFolderView.ts
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';

const folderViewMocks = vi.hoisted(() => ({
	refetch: vi.fn(),
}));

vi.mock('../../../hooks/useFolderView', () => ({
	useFolderView: vi.fn(() => ({
		files: [] as ContentItem[],
		total: 0,
		desktopChildren: [],
		loading: false,
		error: null,
		refetch: folderViewMocks.refetch,
		setFiles: vi.fn(),
		setTotal: vi.fn(),
	})),
}));

vi.mock('./useContentList', () => ({
	FILES_PAGE_SIZE: 50,
	useContentList: vi.fn(() => ({
		items: [] as ContentItem[],
		totalItems: 0,
		loading: false,
		error: null,
		setItems: vi.fn(),
		setTotalItems: vi.fn(),
		fetchContent: vi.fn(),
	})),
}));

vi.mock('./useContentManagerAllFilesQuery', () => ({
	useContentManagerAllFilesQuery: vi.fn(() => ({
		items: [] as ContentItem[],
		totalItems: 0,
		loading: false,
		error: null,
		hasMore: false,
		loadedCount: 0,
		loadingMore: false,
		setItems: vi.fn(),
		setTotalItems: vi.fn(),
		fetchContent: vi.fn(),
		loadMore: vi.fn(),
	})),
}));

vi.mock('../../../notifications', () => ({
	notify: { error: vi.fn() },
}));

import { useFolderView } from '../../../hooks/useFolderView';
import { useContentManagerContentListOrchestration } from './useContentManagerContentListOrchestration';

const t = ((key: string) =>
	key) as import('i18next').TFunction<'contentManager'>;

describe('useContentManagerContentListOrchestration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		folderViewMocks.refetch.mockResolvedValue(null);
		vi.mocked(useFolderView).mockImplementation(() => ({
			files: [],
			total: 0,
			desktopChildren: [],
			loading: false,
			error: null,
			refetch: folderViewMocks.refetch,
			setFiles: vi.fn(),
			setTotal: vi.fn(),
			data: null,
		}));
	});

	it('wires folder-view with TanStack auto-fetch in explorer browse mode', () => {
		renderHook(() =>
			useContentManagerContentListOrchestration({
				t,
				filesBrowseMode: 'explorer',
				explorerFolderTarget: 'documents',
				filterFolderId: null,
				filterCompanyId: null,
				filterProjectId: null,
				currentPage: 1,
				searchQuery: '',
				searchMode: 'keyword',
				filterType: 'all',
				filterVisibility: 'all',
				filterTag: null,
				sortField: 'updated_at',
				sortOrder: 'desc',
				setGroupBy: vi.fn(),
				minFileSize: 2048,
				processingStatus: 'failed',
			})
		);

		expect(useFolderView).toHaveBeenCalledWith(
			expect.objectContaining({
				enabled: true,
				auto: true,
				folderItemId: 'documents',
				minFileSize: 2048,
				processingStatus: 'failed',
			})
		);
	});
});
