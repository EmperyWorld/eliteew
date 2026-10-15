/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Files-tab filter, sort, browse-mode, and advanced search state for Content Manager.
 *
 * Invariants:
 * - Explorer folder navigation is separate from catalog folder filter.
 * - Filter changes reset pagination via parent effect.
 *
 * Related:
 * - ContentManagerPro.tsx, useContentManagerUrlSync.ts
 */
import { useCallback, useState } from 'react';
import type { ContentAdvancedSearchHit } from '../../../services/contentApi';
import type {
	ExplorerFolderTarget,
	FilesBrowseMode,
	FilterVisibility,
	GroupBy,
	SortField,
	SortOrder,
	ViewMode,
} from '../contentManagerTypes';

export type ContentSearchMode = 'keyword' | 'hybrid';

export function useContentManagerFilesFilters() {
	const [viewMode, setViewMode] = useState<ViewMode>('grid');
	const [gridColumnCount, setGridColumnCount] = useState(4);
	const [gridFocusIndex, setGridFocusIndex] = useState(0);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchMode, setSearchMode] = useState<ContentSearchMode>('keyword');
	const [filterType, setFilterType] = useState('all');
	const [filterVisibility, setFilterVisibility] =
		useState<FilterVisibility>('all');
	const [sortField, setSortField] = useState<SortField>('updated_at');
	const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
	const [groupBy, setGroupBy] = useState<GroupBy>('none');
	const [showFilters, setShowFilters] = useState(false);
	const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
	const [advancedQuery, setAdvancedQuery] = useState('');
	const [advancedTags, setAdvancedTags] = useState('');
	const [advancedContentType, setAdvancedContentType] = useState('all');
	const [advancedVisibility, setAdvancedVisibility] =
		useState<FilterVisibility>('all');
	const [advancedDateFrom, setAdvancedDateFrom] = useState('');
	const [advancedDateTo, setAdvancedDateTo] = useState('');
	const [advancedSizeMin, setAdvancedSizeMin] = useState('');
	const [advancedSizeMax, setAdvancedSizeMax] = useState('');
	const [advancedResults, setAdvancedResults] = useState<
		ContentAdvancedSearchHit[]
	>([]);
	const [advancedTotal, setAdvancedTotal] = useState(0);
	const [advancedPage, setAdvancedPage] = useState(1);
	const [advancedLoading, setAdvancedLoading] = useState(false);

	const [filesBrowseMode, setFilesBrowseMode] =
		useState<FilesBrowseMode>('explorer');
	const [explorerFolderTarget, setExplorerFolderTarget] =
		useState<ExplorerFolderTarget>('unfiled');
	const [filterFolderId, setFilterFolderId] = useState<string | null>(null);
	const [filterCompanyId, setFilterCompanyId] = useState<string | null>(null);
	const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
	const [filterTag, setFilterTag] = useState<string | null>(null);

	const resetListFilters = useCallback(() => {
		setSearchQuery('');
		setSearchMode('keyword');
		setFilterType('all');
		setFilterVisibility('all');
		setFilterFolderId(null);
		setFilterCompanyId(null);
		setFilterProjectId(null);
		setFilterTag(null);
	}, []);

	return {
		viewMode,
		setViewMode,
		gridColumnCount,
		setGridColumnCount,
		gridFocusIndex,
		setGridFocusIndex,
		searchQuery,
		setSearchQuery,
		searchMode,
		setSearchMode,
		filterType,
		setFilterType,
		filterVisibility,
		setFilterVisibility,
		sortField,
		setSortField,
		sortOrder,
		setSortOrder,
		groupBy,
		setGroupBy,
		showFilters,
		setShowFilters,
		showAdvancedSearch,
		setShowAdvancedSearch,
		advancedQuery,
		setAdvancedQuery,
		advancedTags,
		setAdvancedTags,
		advancedContentType,
		setAdvancedContentType,
		advancedVisibility,
		setAdvancedVisibility,
		advancedDateFrom,
		setAdvancedDateFrom,
		advancedDateTo,
		setAdvancedDateTo,
		advancedSizeMin,
		setAdvancedSizeMin,
		advancedSizeMax,
		setAdvancedSizeMax,
		advancedResults,
		setAdvancedResults,
		advancedTotal,
		setAdvancedTotal,
		advancedPage,
		setAdvancedPage,
		advancedLoading,
		setAdvancedLoading,
		filesBrowseMode,
		setFilesBrowseMode,
		explorerFolderTarget,
		setExplorerFolderTarget,
		filterFolderId,
		setFilterFolderId,
		filterCompanyId,
		setFilterCompanyId,
		filterProjectId,
		setFilterProjectId,
		filterTag,
		setFilterTag,
		resetListFilters,
	};
}

export type ContentManagerFilesFiltersState = ReturnType<
	typeof useContentManagerFilesFilters
>;
