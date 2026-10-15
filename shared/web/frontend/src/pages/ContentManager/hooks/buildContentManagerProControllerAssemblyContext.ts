/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Maps grouped Content Manager Pro controller wiring into the flat MainSurface assembly context (Wave 4b).
 *
 * Invariants:
 * - Output shape matches ContentManagerProControllerAssemblyContext exactly; no prop renames.
 *
 * Related:
 * - useContentManagerProController.ts, contentManagerProControllerAssemblyContext.ts
 */
import type { TFunction } from 'i18next';
import type { useFriendsList } from '@/features/friends/hooks/useFriends';
import type { useDesktopShellFrame } from '../../Desktop/context/DesktopShellFrameContext';
import type { ContentManagerProControllerAssemblyContext } from './contentManagerProControllerAssemblyContext';
import type { useContentManagerAutoSortActions } from './useContentManagerAutoSortActions';
import type { useContentManagerBulkModals } from './useContentManagerBulkModals';
import type { useContentManagerContentListOrchestration } from './useContentManagerContentListOrchestration';
import type { useContentManagerDeepLinkActions } from './useContentManagerDeepLinkActions';
import type { useContentManagerEditForm } from './useContentManagerEditForm';
import type { useContentManagerExplorerFolders } from './useContentManagerExplorerFolders';
import type { useContentManagerFileGroups } from './useContentManagerFileGroups';
import type { useContentManagerFileOperations } from './useContentManagerFileOperations';
import type { useContentManagerFilesFilters } from './useContentManagerFilesFilters';
import type { useContentManagerFilesUiDerived } from './useContentManagerFilesUiDerived';
import type { useContentManagerInsights } from './useContentManagerInsights';
import type { useContentManagerPreviewKeyboard } from './useContentManagerPreviewKeyboard';
import type { useContentManagerProControllerDerived } from './useContentManagerProControllerDerived';
import type { ContentManagerProControllerShellState } from './useContentManagerProControllerShellState';
import type { useContentManagerSelection } from './useContentManagerSelection';
import type { useContentManagerUploadDragSurface } from './useContentManagerUploadDragSurface';
import type { useContentManagerUploadOrchestration } from './useContentManagerUploadOrchestration';
import type { useContentManagerVersions } from './useContentManagerVersions';
import type { useTenancyOptions } from './useTenancyOptions';
import { resolveContentManagerListPaginationTotal } from '../utils/contentManagerListPagination';

type ShellFrame = ReturnType<typeof useDesktopShellFrame>;
type Filters = ReturnType<typeof useContentManagerFilesFilters>;
type ListOrchestration = ReturnType<
	typeof useContentManagerContentListOrchestration
>;
type Insights = ReturnType<typeof useContentManagerInsights>;
type ExplorerFolders = ReturnType<typeof useContentManagerExplorerFolders>;
type FileGroups = ReturnType<typeof useContentManagerFileGroups>;
type SelectionHook = ReturnType<typeof useContentManagerSelection>;
type BulkModalsHook = ReturnType<typeof useContentManagerBulkModals>;
type UploadOrchestration = ReturnType<
	typeof useContentManagerUploadOrchestration
>;
type PreviewKeyboard = ReturnType<typeof useContentManagerPreviewKeyboard>;
type VersionsHook = ReturnType<typeof useContentManagerVersions>;
type EditFormHook = ReturnType<typeof useContentManagerEditForm>;
type FileOperations = ReturnType<typeof useContentManagerFileOperations>;
type DragSurface = ReturnType<typeof useContentManagerUploadDragSurface>;
type AutoSortHook = ReturnType<typeof useContentManagerAutoSortActions>;
type DeepLinkHook = ReturnType<typeof useContentManagerDeepLinkActions>;
type UiDerived = ReturnType<typeof useContentManagerFilesUiDerived>;
type TenancyOptions = ReturnType<typeof useTenancyOptions>;
type FriendsQuery = ReturnType<typeof useFriendsList>;
type Derived = ReturnType<typeof useContentManagerProControllerDerived>;

export type BuildContentManagerProControllerAssemblyContextParams = {
	t: TFunction<'contentManager'>;
	embedded: boolean;
	embeddedMobileLayout: boolean;
	isMobile: boolean;
	formatSize: (bytes: number) => string;
	shellFrame: ShellFrame;
	shellContentPanelClass: string;
	dragOverlayZ: number;
	shell: ContentManagerProControllerShellState;
	filters: Filters;
	list: ListOrchestration;
	insights: Insights;
	explorer: ExplorerFolders;
	groups: Pick<
		FileGroups,
		'filePanelGroups' | 'filteredItems' | 'onAllFilesShowMoreInFolder'
	>;
	selection: SelectionHook;
	bulkModals: BulkModalsHook;
	derived: Derived;
	selectedContentId: string | null;
	upload: UploadOrchestration;
	preview: PreviewKeyboard;
	versions: VersionsHook;
	editForm: EditFormHook;
	friendsForEditQuery: FriendsQuery;
	fileOps: FileOperations;
	dragSurface: DragSurface;
	autoSort: AutoSortHook;
	deepLink: DeepLinkHook;
	uiDerived: UiDerived;
	tenancy: Pick<
		TenancyOptions,
		| 'companies'
		| 'projects'
		| 'loadingCompanies'
		| 'loadingProjects'
		| 'refreshProjects'
	>;
	savedViewId:
		| import('./useContentManagerSavedViews').ContentManagerSavedViewId
		| null;
	runAdvancedSearchPage: (page: number) => void | Promise<void>;
	clearAdvancedSearch: () => void;
};

export function buildContentManagerProControllerAssemblyContext({
	t,
	embedded,
	embeddedMobileLayout,
	isMobile,
	formatSize,
	shellFrame,
	shellContentPanelClass,
	dragOverlayZ,
	shell,
	filters,
	list,
	insights,
	explorer,
	groups,
	selection,
	bulkModals,
	derived,
	selectedContentId,
	upload,
	preview,
	versions,
	editForm,
	friendsForEditQuery,
	fileOps,
	dragSurface,
	autoSort,
	deepLink,
	uiDerived,
	tenancy,
	savedViewId,
	runAdvancedSearchPage,
	clearAdvancedSearch,
}: BuildContentManagerProControllerAssemblyContextParams): ContentManagerProControllerAssemblyContext {
	const {
		error,
		setError,
		success,
		setSuccess,
		activeTab,
		setActiveTab,
		statsTabKey,
		setStatsTabKey,
		tagsTabKey,
		setTagsTabKey,
		versionsTabKey,
		setVersionsTabKey,
		sharedTabKey,
		setSharedTabKey,
		commentsTabKey,
		setCommentsTabKey,
		duplicatesTabKey,
		setDuplicatesTabKey,
		brokenFilesTabKey,
		setBrokenFilesTabKey,
		contentGuideOpen,
		setContentGuideOpen,
		advancedError,
		setAdvancedError,
		fileInputRef,
		rootRef,
		searchInputRef,
		assignTenancyOpen,
		setAssignTenancyOpen,
		assignCompanyId,
		setAssignCompanyId,
		assignProjectId,
		setAssignProjectId,
		assignTenancyLoading,
		currentPage,
		setCurrentPage,
	} = shell;

	const {
		viewMode,
		setViewMode,
		gridColumnCount,
		setGridColumnCount,
		gridFocusIndex,
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
	} = filters;

	const {
		stats,
		statsLoading,
		quotaBytesUsed,
		quotaBytesLimit,
		quotaLoading,
		quotaError,
		fetchQuota,
		managerActivities,
		managerActivityLoading,
		viewHistoryEntries,
		viewHistoryLoading,
		popularTags,
		sharedContents,
		sharedLoading,
		currentContentUserId,
		registerView,
		clearViewHistoryDb,
		handleDuplicateFinderChange,
		handleBrokenFilesChange,
		handleSharedContentsRefresh,
	} = insights;

	const {
		totalItems,
		loading,
		contentListError,
		fetchContent,
		allFilesHasMore,
		allFilesLoadingMore,
		allFilesLoadedCount,
		allFilesLoadMore,
	} = list;

	const {
		folders,
		folderTreeRoots,
		explorerNestedFolders,
		explorerExpandedFolderIds,
		setExplorerExpandedFolderIds,
		explorerDropHighlight,
		setExplorerDropHighlight,
		folderMenuTarget,
		folderMenuPos,
		fetchFolders,
		openFolderMenu,
		closeFolderMenu,
		createFolderUnderParent,
		renameExplorerFolder,
		deleteExplorerFolder,
		onExplorerDropToFolder,
	} = explorer;

	const { filePanelGroups, filteredItems, onAllFilesShowMoreInFolder } = groups;

	const {
		contentTypeOptionsForAdvanced,
		resolveContentTypeLabel,
		versionsCompanies,
		versionsProjects,
		cabinetLocked,
		cabinetProjectLabel,
		selectedContent,
		hasAdvancedResults,
		advancedTotalPages,
		noopUndoActivity,
		handleFileCommentsAfterUpdate,
	} = derived;

	const ownedFilesCount = stats?.totalFiles ?? 0;
	const listPaginationTotal = resolveContentManagerListPaginationTotal({
		apiTotalItems: totalItems,
		filteredVisibleCount: filteredItems.length,
		// Size / processing_status filters are applied server-side on GET /content.
		hasClientListFilters: false,
	});

	return {
		t,
		embedded,
		embeddedMobileLayout,
		rootRef,
		dragSurface,
		dragOverlayZ,
		filesBrowseMode,
		explorerFolderTarget,
		uiDerived,
		shellFrame,
		activeTab,
		setActiveTab,
		stats,
		totalItems: listPaginationTotal,
		formatSize,
		fetchContent,
		loading,
		fileInputRef,
		upload,
		fileOps,
		statsLoading,
		ownedFilesCount,
		success,
		setSuccess,
		error,
		setError,
		shellContentPanelClass,
		statsTabKey,
		setStatsTabKey,
		managerActivities,
		managerActivityLoading,
		noopUndoActivity,
		viewHistoryEntries,
		viewHistoryLoading,
		clearViewHistoryDb,
		preview,
		registerView,
		quotaBytesUsed,
		quotaBytesLimit,
		quotaLoading,
		quotaError,
		onQuotaRetry: fetchQuota,
		tagsTabKey,
		setTagsTabKey,
		popularTags,
		onTagSelect: (tag: string) => {
			setFilterTag(tag);
			setSearchQuery('');
			setFilesBrowseMode('catalog');
			setFilterFolderId(null);
			setExplorerFolderTarget('unfiled');
			setActiveTab('files');
			setCurrentPage(1);
		},
		setSearchQuery,
		versionsTabKey,
		setVersionsTabKey,
		versions,
		selectedContent,
		versionsCompanies,
		versionsProjects,
		selection,
		sharedTabKey,
		setSharedTabKey,
		sharedContents,
		sharedLoading,
		handleSharedContentsRefresh,
		deepLink,
		commentsTabKey,
		setCommentsTabKey,
		selectedContentId,
		currentContentUserId,
		handleFileCommentsAfterUpdate,
		duplicatesTabKey,
		setDuplicatesTabKey,
		handleDuplicateFinderChange,
		brokenFilesTabKey,
		setBrokenFilesTabKey,
		handleBrokenFilesChange,
		resolveContentTypeLabel,
		folderMenuTarget,
		folderMenuPos,
		closeFolderMenu,
		setExplorerFolderTarget,
		createFolderUnderParent,
		renameExplorerFolder,
		deleteExplorerFolder,
		fetchFolders,
		contentGuideOpen,
		setContentGuideOpen,
		savedViewId,
		advancedQuery,
		setAdvancedQuery,
		advancedContentType,
		setAdvancedContentType,
		advancedVisibility,
		setAdvancedVisibility,
		advancedTags,
		setAdvancedTags,
		advancedDateFrom,
		setAdvancedDateFrom,
		advancedDateTo,
		setAdvancedDateTo,
		advancedSizeMin,
		setAdvancedSizeMin,
		advancedSizeMax,
		setAdvancedSizeMax,
		contentTypeOptionsForAdvanced,
		clearAdvancedSearch,
		runAdvancedSearchPage,
		advancedLoading,
		hasAdvancedResults,
		advancedError,
		advancedResults,
		advancedTotal,
		advancedPage,
		advancedTotalPages,
		setAdvancedResults,
		setAdvancedTotal,
		setAdvancedError,
		setAdvancedPage,
		bulkModals,
		cabinetLocked,
		cabinetProjectLabel,
		setFilesBrowseMode,
		folderTreeRoots,
		explorerNestedFolders,
		openFolderMenu,
		searchQuery,
		setSearchMode,
		searchMode,
		searchInputRef,
		sortField,
		sortOrder,
		setSortField,
		setSortOrder,
		setCurrentPage,
		currentPage,
		showFilters,
		setShowFilters,
		showAdvancedSearch,
		setShowAdvancedSearch,
		autoSort,
		viewMode,
		setViewMode,
		filterFolderId,
		setFilterFolderId,
		folders,
		filterCompanyId,
		setFilterCompanyId,
		companies: tenancy.companies,
		loadingCompanies: tenancy.loadingCompanies,
		filterProjectId,
		setFilterProjectId,
		projects: tenancy.projects,
		loadingProjects: tenancy.loadingProjects,
		filterType,
		setFilterType,
		filterVisibility,
		setFilterVisibility,
		filterTag,
		setFilterTag,
		groupBy,
		setGroupBy,
		setAssignCompanyId,
		setAssignProjectId,
		refreshProjects: tenancy.refreshProjects,
		setAssignTenancyOpen,
		explorerExpandedFolderIds,
		setExplorerExpandedFolderIds,
		explorerDropHighlight,
		setExplorerDropHighlight,
		onExplorerDropToFolder,
		contentListError,
		filteredItems,
		filePanelGroups,
		handleAllFilesShowMoreInFolder: onAllFilesShowMoreInFolder,
		isMobile,
		gridFocusIndex,
		gridColumnCount,
		setGridColumnCount,
		allFilesHasMore,
		allFilesLoadingMore,
		allFilesLoadedCount,
		allFilesLoadMore,
		editForm,
		friendsForEditQuery,
		assignTenancyOpen,
		assignTenancyLoading,
		assignCompanyId,
		assignProjectId,
	};
}
