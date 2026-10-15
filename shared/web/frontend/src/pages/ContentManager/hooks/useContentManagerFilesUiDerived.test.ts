/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock for saved-view apply: files tab, browse mode, and catalog filters.
 *
 * Related:
 * - useContentManagerFilesUiDerived.ts
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ContentManagerSavedViewId } from './useContentManagerSavedViews';
import {
	useContentManagerFilesUiDerived,
	type UseContentManagerFilesUiDerivedParams,
} from './useContentManagerFilesUiDerived';

const t = ((key: string) =>
	key) as import('i18next').TFunction<'contentManager'>;

function buildParams(
	overrides: Partial<UseContentManagerFilesUiDerivedParams> = {}
): UseContentManagerFilesUiDerivedParams {
	const setActiveTab =
		vi.fn<UseContentManagerFilesUiDerivedParams['setActiveTab']>();
	const setCurrentPage =
		vi.fn<UseContentManagerFilesUiDerivedParams['setCurrentPage']>();
	const setFilesBrowseMode =
		vi.fn<UseContentManagerFilesUiDerivedParams['setFilesBrowseMode']>();
	const setExplorerFolderTarget =
		vi.fn<UseContentManagerFilesUiDerivedParams['setExplorerFolderTarget']>();
	const setFilterFolderId =
		vi.fn<UseContentManagerFilesUiDerivedParams['setFilterFolderId']>();
	const setFilterTag =
		vi.fn<UseContentManagerFilesUiDerivedParams['setFilterTag']>();
	const setSearchQuery =
		vi.fn<UseContentManagerFilesUiDerivedParams['setSearchQuery']>();
	const setFilterVisibility =
		vi.fn<UseContentManagerFilesUiDerivedParams['setFilterVisibility']>();
	const setFilterType =
		vi.fn<UseContentManagerFilesUiDerivedParams['setFilterType']>();
	const setClientMinFileSize =
		vi.fn<UseContentManagerFilesUiDerivedParams['setClientMinFileSize']>();
	const setClientProcessingStatusFilter =
		vi.fn<
			UseContentManagerFilesUiDerivedParams['setClientProcessingStatusFilter']
		>();
	const applySavedView: UseContentManagerFilesUiDerivedParams['applySavedView'] =
		(id: ContentManagerSavedViewId) => {
			if (id === 'fromFriends') {
				return {
					filterVisibility: 'from_friends',
					sortField: 'updated_at',
					sortOrder: 'desc',
				};
			}
			if (id === 'processingErrors') {
				return {
					processingStatus: 'failed',
					sortField: 'updated_at',
					sortOrder: 'desc',
				};
			}
			return {};
		};

	return {
		t,
		embedded: false,
		previewItem: null,
		rootRef: { current: null },
		activeTab: 'stats',
		searchQuery: '',
		filterType: 'all',
		filterVisibility: 'all',
		filterTag: null,
		filesBrowseMode: 'explorer',
		filterFolderId: null,
		filterCompanyId: null,
		filterProjectId: null,
		explorerFolderTarget: 'unfiled',
		desktopFolderItems: [],
		filteredItems: [],
		setActiveTab,
		setCurrentPage,
		setSearchQuery,
		setFilterTag,
		setFilterFolderId,
		setClientMinFileSize,
		setClientProcessingStatusFilter,
		setFilesBrowseMode,
		setExplorerFolderTarget,
		setFilterVisibility,
		setFilterType,
		setSortField: vi.fn(),
		setSortOrder: vi.fn(),
		applySavedView,
		clearSavedView: vi.fn(),
		setSelectedIds: vi.fn(),
		selectionAnchorIndexRef: { current: null },
		...overrides,
	};
}

describe('useContentManagerFilesUiDerived saved views', () => {
	it('fromFriends switches to files catalog and applies visibility', () => {
		const params = buildParams();
		const { result } = renderHook(() =>
			useContentManagerFilesUiDerived(params)
		);

		act(() => {
			result.current.handleSavedViewSelect('fromFriends');
		});

		expect(params.setActiveTab).toHaveBeenCalledWith('files');
		expect(params.setCurrentPage).toHaveBeenCalledWith(1);
		expect(params.setFilesBrowseMode).toHaveBeenCalledWith('catalog');
		expect(params.setFilterVisibility).toHaveBeenCalledWith('from_friends');
		expect(params.setSearchQuery).toHaveBeenCalledWith('');
		expect(params.setFilterTag).toHaveBeenCalledWith(null);
	});

	it('processingErrors switches to catalog and sets client processing filter', () => {
		const params = buildParams();
		const { result } = renderHook(() =>
			useContentManagerFilesUiDerived(params)
		);

		act(() => {
			result.current.handleSavedViewSelect('processingErrors');
		});

		expect(params.setActiveTab).toHaveBeenCalledWith('files');
		expect(params.setFilesBrowseMode).toHaveBeenCalledWith('catalog');
		expect(params.setClientProcessingStatusFilter).toHaveBeenCalledWith(
			'failed'
		);
	});
});
