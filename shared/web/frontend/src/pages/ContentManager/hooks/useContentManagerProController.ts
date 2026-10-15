/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 4b orchestration hook: wires list, explorer, upload, preview, and MainSurface
 * prop assembly for Content Manager Pro via shell/derived/effects helpers.
 *
 * Invariants:
 * - Parent ContentManagerPro.tsx stays a thin shell; forbidden direct ContentManagerFilesTab
 *   import remains in parent only via MainSurface bridge.
 * - Controller stays under 800 LOC; heavy wiring lives in Wave 4b modules.
 *
 * Related:
 * - ContentManagerPro.tsx, ContentManagerProMainSurface.tsx
 * - useContentManagerProControllerShellState.ts, useContentManagerProControllerDerived.ts
 * - useContentManagerProControllerEffects.ts, buildContentManagerProControllerAssemblyContext.ts
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../../components/UnifiedContent/utils/contentUtils';
import { useFriendsList } from '@/features/friends/hooks/useFriends';
import { useResponsive } from '../../../hooks/useResponsive';
import { isMobileContentManagerEmbeddedRoute } from '@/utils/mobileEmbeddedSpaRoute';
import { useDesktopShellFrame } from '../../Desktop/context/DesktopShellFrameContext';
import { useDesktopEmbeddedDragOverlayZIndex } from '../../Desktop/context/DesktopWindowPortalStackContext';
import { getDesktopShellContentPanelClassName } from '../../Desktop/utils/desktopVisualSystem';
import type { ContentManagerProMainSurfaceProps } from '../components/ContentManagerProMainSurface';
import type { ContentManagerProProps } from '../contentManagerProTypes';
import { assembleContentManagerProMainSurfaceProps } from './assembleContentManagerProMainSurfaceProps';
import { buildContentManagerProControllerAssemblyContext } from './buildContentManagerProControllerAssemblyContext';
import { useContentManagerAdvancedSearchActions } from './useContentManagerAdvancedSearchActions';
import { useContentManagerAutoSortActions } from './useContentManagerAutoSortActions';
import { useContentManagerBlobUpdateSync } from './useContentManagerBlobUpdateSync';
import { useContentManagerBulkModals } from './useContentManagerBulkModals';
import { useContentManagerContentListOrchestration } from './useContentManagerContentListOrchestration';
import { useContentManagerDeepLinkActions } from './useContentManagerDeepLinkActions';
import { useContentManagerEditForm } from './useContentManagerEditForm';
import { useContentManagerEmbeddedShellBridge } from './useContentManagerEmbeddedShellBridge';
import { useContentManagerExplorerFolders } from './useContentManagerExplorerFolders';
import { useContentManagerFileGroups } from './useContentManagerFileGroups';
import { useContentManagerFileOperations } from './useContentManagerFileOperations';
import { useContentManagerFilesFilters } from './useContentManagerFilesFilters';
import { useContentManagerFilesUiDerived } from './useContentManagerFilesUiDerived';
import { useContentManagerInsights } from './useContentManagerInsights';
import { useContentManagerPreviewKeyboard } from './useContentManagerPreviewKeyboard';
import { useContentManagerProControllerDerived } from './useContentManagerProControllerDerived';
import { useContentManagerProControllerEffects } from './useContentManagerProControllerEffects';
import { useContentManagerProControllerShellState } from './useContentManagerProControllerShellState';
import { useContentManagerSavedViews } from './useContentManagerSavedViews';
import { useContentManagerSelection } from './useContentManagerSelection';
import { useContentManagerUploadDragSurface } from './useContentManagerUploadDragSurface';
import { useContentManagerUploadOrchestration } from './useContentManagerUploadOrchestration';
import { useContentManagerUrlSync } from './useContentManagerUrlSync';
import { useContentManagerVersions } from './useContentManagerVersions';
import { useTenancyOptions } from './useTenancyOptions';

export function useContentManagerProController({
	embedded = false,
	embeddedMobile,
	initialCabinetScope = null,
	initialDesktopFolderItemId = null,
	initialFilterSnapshot = null,
	initialFocusUnifiedContentId = null,
	initialOpenAssignProject = false,
	initialActiveTab = null,
	onWindowPayloadChange,
}: ContentManagerProProps): ContentManagerProMainSurfaceProps {
	const embeddedMobileLayout =
		embeddedMobile ?? isMobileContentManagerEmbeddedRoute();
	const { t, i18n } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellContentPanelClass = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const dragOverlayZ = useDesktopEmbeddedDragOverlayZIndex();
	const formatSize = useCallback(
		(bytes: number) => formatBytes(bytes, i18n.language),
		[i18n.language]
	);
	const { isMobile } = useResponsive();

	const shell = useContentManagerProControllerShellState({
		embeddedMobileLayout,
		initialActiveTab,
	});
	const {
		setError,
		setSuccess,
		activeTab,
		setActiveTab,
		setAdvancedError,
		fileInputRef,
		rootRef,
		searchInputRef,
		setAssignTenancyOpen,
		assignCompanyId,
		assignProjectId,
		setAssignTenancyLoading,
		clientMinFileSize,
		setClientMinFileSize,
		clientProcessingStatusFilter,
		setClientProcessingStatusFilter,
		currentPage,
		setCurrentPage,
		advancedError,
	} = shell;

	const filters = useContentManagerFilesFilters();
	const {
		viewMode,
		gridColumnCount,
		gridFocusIndex,
		setGridFocusIndex,
		searchQuery,
		setSearchQuery,
		searchMode,
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
		setShowFilters,
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
	} = filters;

	const {
		activeViewId: savedViewId,
		applyView: applySavedView,
		clearView: clearSavedView,
	} = useContentManagerSavedViews();

	const tenancy = useTenancyOptions();
	const { companies, projects, refreshProjects } = tenancy;

	const listOrchestration = useContentManagerContentListOrchestration({
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
		minFileSize: clientMinFileSize,
		processingStatus: clientProcessingStatusFilter,
	});

	const {
		uploadFolderItemId,
		items,
		setItems,
		setTotalItems,
		loading,
		fetchContent,
		folderView,
	} = listOrchestration;

	const insights = useContentManagerInsights({ t, activeTab, fetchContent });
	const { fetchManagerActivity, fetchStats, registerView } = insights;

	const explorerFolders = useContentManagerExplorerFolders({
		t,
		items,
		projects,
		filesBrowseMode,
		explorerFolderTarget,
		setExplorerFolderTarget,
		folderViewDesktopChildren: folderView.desktopChildren,
		fetchContent,
		fetchStats,
		fetchManagerActivity,
	});

	const { desktopFolderItems, setExplorerExpandedFolderIds, fetchFolders } =
		explorerFolders;

	const fileGroups = useContentManagerFileGroups({
		t,
		language: i18n.language,
		items,
		desktopFolderItems,
		filesBrowseMode,
		groupBy,
		loading,
	});

	const onAfterBulkMutation = useCallback(async () => {
		await fetchContent();
		void fetchManagerActivity();
	}, [fetchContent, fetchManagerActivity]);

	const selection = useContentManagerSelection({
		t,
		filteredItems: fileGroups.filteredItems,
		items,
		filesBrowseMode,
		groupBy,
		currentPage,
		setItems,
		setTotalItems,
		setError,
		setSuccess,
		onAfterBulkMutation,
		assignCompanyId,
		assignProjectId,
		setAssignTenancyOpen,
		setAssignTenancyLoading,
	});

	const bulkModals = useContentManagerBulkModals({
		t,
		items,
		filteredItems: fileGroups.filteredItems,
		projects,
		selectedIds: selection.selectedIds,
		setSelectedIds: selection.setSelectedIds,
		batchCopyLoading: selection.batchCopyLoading,
		setBatchCopyLoading: selection.setBatchCopyLoading,
		setError,
		setSuccess,
		fetchContent,
		fetchManagerActivity,
	});

	useContentManagerUrlSync({
		embedded,
		activeTab,
		setActiveTab,
		filterType,
		setFilterType,
		filterVisibility,
		setFilterVisibility,
	});

	const onUploadSuccess = useCallback(async () => {
		await fetchContent();
		await fetchStats();
		void fetchManagerActivity();
	}, [fetchContent, fetchManagerActivity, fetchStats]);

	const upload = useContentManagerUploadOrchestration({
		t,
		uploadScope: {
			folderItemId: uploadFolderItemId,
			companyId: filterCompanyId,
			projectId: filterProjectId,
		},
		onUploadSuccess,
		setError,
		setSuccess,
	});

	const preview = useContentManagerPreviewKeyboard({
		t,
		activeTab,
		viewMode,
		filteredItems: fileGroups.filteredItems,
		items,
		gridFocusIndex,
		setGridFocusIndex,
		gridColumnCount,
		selectedIds: selection.selectedIds,
		setSelectedIds: selection.setSelectedIds,
		selectMode: selection.selectMode,
		requestBatchDelete: selection.requestBatchDelete,
		setShowFilters,
		searchInputRef,
		rootRef,
		setItems,
		setTotalItems,
		setError,
		setSuccess,
		fetchContent,
		fetchManagerActivity,
		registerView,
	});

	const selectedContentId = useMemo(() => {
		if (preview.previewItem?.id) return preview.previewItem.id;
		const [firstSelectedId] = Array.from(selection.selectedIds);
		return firstSelectedId ?? null;
	}, [preview.previewItem, selection.selectedIds]);

	const versions = useContentManagerVersions({
		t,
		activeTab,
		selectedContentId,
		setSelectedIds: selection.setSelectedIds,
		setPreviewItem: preview.setPreviewItem,
		fetchContent,
		fetchStats,
		setError,
		setSuccess,
	});

	const editForm = useContentManagerEditForm({
		t,
		selectedContentId,
		fetchContent,
		fetchSelectedContentDetails: versions.fetchSelectedContentDetails,
		refreshProjects,
		setError,
		setSuccess,
	});

	const friendsForEditQuery = useFriendsList({
		enabled: Boolean(
			editForm.editItem &&
				!editForm.editForm.company_id.trim() &&
				!editForm.editForm.project_id.trim() &&
				(editForm.editForm.visibility === 'friends' ||
					(editForm.editForm.visibility === 'shared' &&
						editForm.editForm.friend_visibility))
		),
	});

	useContentManagerBlobUpdateSync({
		fetchContent,
		setPreviewItem: preview.setPreviewItem,
		setItems,
	});

	const fileOps = useContentManagerFileOperations({
		t,
		setError,
		setSuccess,
		fetchContent,
		fetchSelectedContentDetails: versions.fetchSelectedContentDetails,
		selectedContentId,
	});

	const dragSurface = useContentManagerUploadDragSurface({
		items,
		selectMode: selection.selectMode,
		selectedIds: selection.selectedIds,
		uploadFiles: upload.uploadFiles,
		fileInputRef,
	});

	const autoSort = useContentManagerAutoSortActions({
		t,
		fetchContent,
		fetchStats,
		fetchFolders,
	});

	const deepLink = useContentManagerDeepLinkActions({
		setError,
		setSelectedIds: selection.setSelectedIds,
		setPreviewItem: preview.setPreviewItem,
		fetchSelectedContentDetails: versions.fetchSelectedContentDetails,
		registerView,
		setAssignTenancyOpen,
	});

	const uiDerived = useContentManagerFilesUiDerived({
		t,
		embedded,
		previewItem: preview.previewItem,
		rootRef,
		activeTab,
		searchQuery,
		filterType,
		filterVisibility,
		filterTag,
		filesBrowseMode,
		filterFolderId,
		filterCompanyId,
		filterProjectId,
		explorerFolderTarget,
		desktopFolderItems,
		filteredItems: fileGroups.filteredItems,
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
		setSortField,
		setSortOrder,
		applySavedView,
		clearSavedView,
		setSelectedIds: selection.setSelectedIds,
		selectionAnchorIndexRef: selection.selectionAnchorIndexRef,
	});

	const { runAdvancedSearchPage, clearAdvancedSearch } =
		useContentManagerAdvancedSearchActions({
			t,
			advancedQuery,
			advancedTags,
			advancedContentType,
			advancedVisibility,
			advancedDateFrom,
			advancedDateTo,
			advancedSizeMin,
			advancedSizeMax,
			setAdvancedError,
			setAdvancedResults,
			setAdvancedTotal,
			setAdvancedPage,
			setAdvancedLoading,
			setAdvancedQuery,
			setAdvancedTags,
			setAdvancedContentType,
			setAdvancedVisibility,
			setAdvancedDateFrom,
			setAdvancedDateTo,
			setAdvancedSizeMin,
			setAdvancedSizeMax,
		});

	const derived = useContentManagerProControllerDerived({
		t,
		initialCabinetScope,
		filterProjectId,
		companies,
		projects,
		preview,
		versions,
		items,
		selectedContentId,
		advancedLoading,
		advancedError,
		advancedResults,
		advancedTotal,
		fetchContent,
	});

	useContentManagerEmbeddedShellBridge({
		embedded,
		onWindowPayloadChange,
		activeTab,
		filesBrowseMode,
		explorerContextPlaceLabel: uiDerived.explorerContextPlaceLabel,
		searchQuery,
		hasActiveListFilters: uiDerived.hasActiveListFilters,
		items,
		selectedIds: selection.selectedIds,
		selectedContent: derived.selectedContent,
		t,
	});

	useContentManagerProControllerEffects({
		shell,
		initialCabinetScope,
		initialDesktopFolderItemId,
		initialFilterSnapshot,
		initialFocusUnifiedContentId,
		initialOpenAssignProject,
		filterFolderId,
		filesBrowseMode,
		explorerFolderTarget,
		filterCompanyId,
		filterProjectId,
		searchQuery,
		filterType,
		filterVisibility,
		filterTag,
		sortField,
		sortOrder,
		setFilterCompanyId,
		setFilterProjectId,
		setFilterFolderId,
		setFilesBrowseMode,
		setGroupBy,
		setExplorerFolderTarget,
		setExplorerExpandedFolderIds,
		setSearchQuery,
		setFilterType,
		setFilterVisibility,
		fetchFolders,
		refreshProjects,
		fetchContent,
		fetchStats,
		items,
		selection,
		preview,
		t,
		onOpenAssignProject: deepLink.openAssignProjectFromDeepLink,
		onContentOpened: deepLink.handleContentOpenedFromDeepLink,
	});

	return assembleContentManagerProMainSurfaceProps(
		buildContentManagerProControllerAssemblyContext({
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
			list: listOrchestration,
			insights,
			explorer: explorerFolders,
			groups: fileGroups,
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
		})
	);
}
