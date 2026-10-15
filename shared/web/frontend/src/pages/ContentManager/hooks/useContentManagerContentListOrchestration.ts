/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wires catalog list vs explorer folder-view vs all-files cursor list sources and library refresh.
 *
 * Invariants:
 * - Explorer hybrid search falls back to catalog list; pure explorer uses useFolderView.
 * - «Все файлы» uses cursor paging (`useContentManagerAllFilesQuery`), not client aggregation.
 * - Folder-view uses TanStack Query (`auto: true`, staleTime + keepPreviousData).
 *
 * Related:
 * - useContentManagerProController.ts, useContentList.ts, useFolderView.ts
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { useFolderView } from '../../../hooks/useFolderView';
import { notify } from '../../../notifications';
import { CONTENT_MANAGER_LIBRARY_REFRESH_EVENT } from '../../../services/unifiedContentEvents';
import { getApiErrorMessage } from '../../../utils/apiError';
import { logUxError } from '../../../utils/logger';
import type {
	FilesBrowseMode,
	FilterVisibility,
	SortField,
	SortOrder,
} from '../contentManagerTypes';
import { getContentRecoveryHint } from '../utils/contentManagerProRecovery';
import { resolveContentManagerApiFilter } from '../utils/contentManagerApiFilter';
import { resolveContentManagerUploadFolderItemId } from '../utils/contentManagerUploadTarget';
import { useContentManagerAllFilesQuery } from './useContentManagerAllFilesQuery';
import { FILES_PAGE_SIZE, useContentList } from './useContentList';

export type UseContentManagerContentListOrchestrationParams = {
	t: TFunction<'contentManager'>;
	filesBrowseMode: FilesBrowseMode;
	explorerFolderTarget: string;
	filterFolderId: string | null;
	filterCompanyId: string | null;
	filterProjectId: string | null;
	currentPage: number;
	searchQuery: string;
	searchMode: 'keyword' | 'hybrid';
	filterType: string;
	filterVisibility: FilterVisibility;
	filterTag: string | null;
	sortField: SortField;
	sortOrder: SortOrder;
	setGroupBy: (value: 'none' | 'type' | 'date' | 'folder') => void;
	/** Server-side min file size (bytes). */
	minFileSize?: number | null;
	/** Server-side processing_status filter. */
	processingStatus?: string | null;
};

export function useContentManagerContentListOrchestration({
	t,
	filesBrowseMode,
	explorerFolderTarget,
	filterFolderId,
	filterCompanyId,
	filterProjectId,
	currentPage,
	searchQuery,
	searchMode,
	filterType,
	filterVisibility,
	filterTag,
	sortField,
	sortOrder,
	setGroupBy,
	minFileSize = null,
	processingStatus = null,
}: UseContentManagerContentListOrchestrationParams) {
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

	const listFilterFolderId =
		filesBrowseMode === 'all_files'
			? null
			: filesBrowseMode === 'explorer'
				? explorerFolderTarget === 'unfiled'
					? null
					: explorerFolderTarget
				: filterFolderId;
	const listFolderUnassignedOnly =
		filesBrowseMode === 'explorer' && explorerFolderTarget === 'unfiled';
	const uploadFolderItemId = useMemo(
		() =>
			resolveContentManagerUploadFolderItemId(
				filesBrowseMode,
				explorerFolderTarget,
				filterFolderId
			),
		[filesBrowseMode, explorerFolderTarget, filterFolderId]
	);

	const prevFilesBrowseModeRef = useRef<FilesBrowseMode | null>(null);
	useEffect(() => {
		const prev = prevFilesBrowseModeRef.current;
		if (
			filesBrowseMode === 'all_files' &&
			prev != null &&
			prev !== 'all_files'
		) {
			setGroupBy('folder');
		}
		prevFilesBrowseModeRef.current = filesBrowseMode;
	}, [filesBrowseMode, setGroupBy]);

	const handleContentFetchError = useCallback(
		(err: unknown) => {
			const msg = getApiErrorMessage(err);
			const hint = getContentRecoveryHint('fetch', err, t);
			logUxError(
				'ContentManagerPro',
				'unified_content',
				'fetch',
				err instanceof Error ? err : undefined,
				{ message: msg, hint }
			);
			notify.error(t('pro.notify.listFailed'), `${msg}. ${hint}`, {
				duration: 6000,
			});
		},
		[t]
	);

	const explorerUsesFolderView =
		filesBrowseMode === 'explorer' &&
		!(searchMode === 'hybrid' && debouncedSearchQuery.trim().length > 0);

	const catalogListEnabled =
		!explorerUsesFolderView && filesBrowseMode !== 'all_files';
	const allFilesListEnabled =
		!explorerUsesFolderView && filesBrowseMode === 'all_files';

	const catalogListResult = useContentList({
		filterFolderId: listFilterFolderId,
		folderUnassignedOnly: listFolderUnassignedOnly,
		filterCompanyId,
		filterProjectId,
		currentPage,
		debouncedSearchQuery,
		searchMode,
		filterType,
		filterVisibility,
		filterTag,
		sortField,
		sortOrder,
		aggregateAllPages: false,
		enabled: catalogListEnabled,
		onFetchError: handleContentFetchError,
		minFileSize,
		processingStatus,
	});

	const allFilesListResult = useContentManagerAllFilesQuery({
		filterCompanyId,
		filterProjectId,
		debouncedSearchQuery,
		searchMode,
		filterType,
		filterVisibility: filterVisibility as
			| 'all'
			| 'private'
			| 'shared'
			| 'friends'
			| 'from_friends',
		sortField,
		sortOrder,
		enabled: allFilesListEnabled,
		onFetchError: handleContentFetchError,
		minFileSize,
		processingStatus,
	});

	const activeListResult = allFilesListEnabled
		? allFilesListResult
		: catalogListResult;

	const folderViewSortField = useMemo(() => {
		const fields = {
			name: 'name',
			created_at: 'date',
			updated_at: 'modified',
			file_size: 'size',
			content_type: 'type',
		} as const;
		return fields[sortField];
	}, [sortField]);

	const folderViewApiFilter = useMemo(
		() => resolveContentManagerApiFilter(filterType),
		[filterType]
	);

	const folderView = useFolderView({
		enabled: filesBrowseMode === 'explorer' && explorerUsesFolderView,
		auto: true,
		folderItemId:
			explorerFolderTarget === 'unfiled' ? undefined : explorerFolderTarget,
		unfiled: explorerFolderTarget === 'unfiled',
		search: debouncedSearchQuery,
		sort: { field: folderViewSortField, order: sortOrder },
		limit: FILES_PAGE_SIZE,
		offset: (currentPage - 1) * FILES_PAGE_SIZE,
		contentType: folderViewApiFilter.content_type,
		mimeType: folderViewApiFilter.mime_type,
		minFileSize: minFileSize ?? undefined,
		processingStatus: processingStatus?.trim() || undefined,
	});

	const items = explorerUsesFolderView
		? folderView.files
		: activeListResult.items;
	const setItems = explorerUsesFolderView
		? folderView.setFiles
		: activeListResult.setItems;
	const totalItems = explorerUsesFolderView
		? folderView.total
		: activeListResult.totalItems;
	const setTotalItems = explorerUsesFolderView
		? folderView.setTotal
		: activeListResult.setTotalItems;
	const loading = explorerUsesFolderView
		? folderView.loading
		: activeListResult.loading;
	const contentListError = explorerUsesFolderView
		? folderView.error
		: activeListResult.error;

	const fetchContent = useCallback(async () => {
		if (explorerUsesFolderView) {
			await folderView.refetch();
			return;
		}
		await activeListResult.fetchContent();
	}, [
		activeListResult.fetchContent,
		explorerUsesFolderView,
		folderView.refetch,
	]);

	useEffect(() => {
		if (explorerUsesFolderView) return;
		const onLibraryRefresh = (): void => {
			void fetchContent();
		};
		window.addEventListener(
			CONTENT_MANAGER_LIBRARY_REFRESH_EVENT,
			onLibraryRefresh
		);
		return () =>
			window.removeEventListener(
				CONTENT_MANAGER_LIBRARY_REFRESH_EVENT,
				onLibraryRefresh
			);
	}, [explorerUsesFolderView, fetchContent]);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	useEffect(() => {
		if (explorerUsesFolderView || allFilesListEnabled) return;
		void catalogListResult.fetchContent();
	}, [
		allFilesListEnabled,
		catalogListResult.fetchContent,
		explorerUsesFolderView,
	]);

	return {
		debouncedSearchQuery,
		listFilterFolderId,
		listFolderUnassignedOnly,
		uploadFolderItemId,
		explorerUsesFolderView,
		items,
		setItems,
		totalItems,
		setTotalItems,
		loading,
		contentListError,
		fetchContent,
		folderView,
		allFilesHasMore: allFilesListEnabled ? allFilesListResult.hasMore : false,
		allFilesLoadingMore: allFilesListEnabled
			? allFilesListResult.loadingMore
			: false,
		allFilesLoadedCount: allFilesListEnabled
			? allFilesListResult.loadedCount
			: 0,
		allFilesLoadMore: allFilesListEnabled
			? allFilesListResult.loadMore
			: async () => {},
	} as const;
}

export type ContentManagerListItems = ContentItem[];
