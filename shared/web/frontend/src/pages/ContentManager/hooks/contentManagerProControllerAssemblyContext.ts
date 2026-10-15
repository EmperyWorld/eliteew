/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed assembly bag passed from useContentManagerProController to MainSurface prop builder.
 *
 * Invariants:
 * - Shape mirrors controller locals at return time; no behavior in this module.
 *
 * Related:
 * - useContentManagerProController.ts, assembleContentManagerProMainSurfaceProps.ts
 */
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type {
	Company,
	Content as ContentItem,
	ContentStats,
	Project,
	ShareResponse,
} from '../../../components/UnifiedContent/types';
import type { Activity } from '../../../components/UnifiedContent/hooks/useActivityLog';
import type { ContentViewHistoryApiItem } from '../../../services/contentApi';
import type { useFriendsList } from '@/features/friends/hooks/useFriends';
import type { useDesktopShellFrame } from '../../Desktop/context/DesktopShellFrameContext';
import type {
	ContentManagerTab,
	FilesBrowseMode,
} from '../contentManagerTypes';
import type { useContentManagerAutoSortActions } from './useContentManagerAutoSortActions';
import type { useContentManagerBulkModals } from './useContentManagerBulkModals';
import type { useContentManagerDeepLinkActions } from './useContentManagerDeepLinkActions';
import type { useContentManagerEditForm } from './useContentManagerEditForm';
import type { useContentManagerFileGroups } from './useContentManagerFileGroups';
import type { useContentManagerFileOperations } from './useContentManagerFileOperations';
import type { useContentManagerFilesUiDerived } from './useContentManagerFilesUiDerived';
import type { useContentManagerPreviewKeyboard } from './useContentManagerPreviewKeyboard';
import type { useContentManagerSelection } from './useContentManagerSelection';
import type { useContentManagerUploadDragSurface } from './useContentManagerUploadDragSurface';
import type { useContentManagerUploadOrchestration } from './useContentManagerUploadOrchestration';
import type { useContentManagerVersions } from './useContentManagerVersions';
import type { ContentManagerSavedViewId } from './useContentManagerSavedViews';

type ShellFrame = ReturnType<typeof useDesktopShellFrame>;
type DragSurface = ReturnType<typeof useContentManagerUploadDragSurface>;
type UploadOrchestration = ReturnType<
	typeof useContentManagerUploadOrchestration
>;
type FileOperations = ReturnType<typeof useContentManagerFileOperations>;
type UiDerived = ReturnType<typeof useContentManagerFilesUiDerived>;
type PreviewKeyboard = ReturnType<typeof useContentManagerPreviewKeyboard>;
type VersionsHook = ReturnType<typeof useContentManagerVersions>;
type SelectionHook = ReturnType<typeof useContentManagerSelection>;
type BulkModalsHook = ReturnType<typeof useContentManagerBulkModals>;
type AutoSortHook = ReturnType<typeof useContentManagerAutoSortActions>;
type DeepLinkHook = ReturnType<typeof useContentManagerDeepLinkActions>;
type EditFormHook = ReturnType<typeof useContentManagerEditForm>;
type FriendsQuery = ReturnType<typeof useFriendsList>;
type FileGroupsHook = ReturnType<typeof useContentManagerFileGroups>;

export type ContentManagerProControllerAssemblyContext = {
	t: TFunction<'contentManager'>;
	embedded: boolean;
	embeddedMobileLayout: boolean;
	rootRef: RefObject<HTMLElement | null>;
	dragSurface: DragSurface;
	dragOverlayZ: number;
	filesBrowseMode: FilesBrowseMode;
	explorerFolderTarget: string;
	uiDerived: UiDerived;
	shellFrame: ShellFrame;
	activeTab: ContentManagerTab;
	setActiveTab: Dispatch<SetStateAction<ContentManagerTab>>;
	stats: ContentStats | null;
	totalItems: number;
	formatSize: (bytes: number) => string;
	fetchContent: () => void | Promise<void>;
	loading: boolean;
	fileInputRef: RefObject<HTMLInputElement | null>;
	upload: UploadOrchestration;
	fileOps: FileOperations;
	statsLoading: boolean;
	ownedFilesCount: number;
	success: string | null;
	setSuccess: Dispatch<SetStateAction<string | null>>;
	error: string | null;
	setError: Dispatch<SetStateAction<string | null>>;
	shellContentPanelClass: string;
	statsTabKey: number;
	setStatsTabKey: Dispatch<SetStateAction<number>>;
	managerActivities: Activity[];
	managerActivityLoading: boolean;
	noopUndoActivity: () => Promise<boolean>;
	viewHistoryEntries: ContentViewHistoryApiItem[];
	viewHistoryLoading: boolean;
	clearViewHistoryDb: () => void | Promise<void>;
	preview: PreviewKeyboard;
	registerView: (item: ContentItem) => void | Promise<void>;
	quotaBytesUsed: number | null;
	quotaBytesLimit: number | null;
	quotaLoading: boolean;
	quotaError: string | null;
	onQuotaRetry: () => void;
	tagsTabKey: number;
	setTagsTabKey: Dispatch<SetStateAction<number>>;
	popularTags: Array<{ tag: string; count: number }>;
	onTagSelect: (tag: string) => void;
	setSearchQuery: Dispatch<SetStateAction<string>>;
	versionsTabKey: number;
	setVersionsTabKey: Dispatch<SetStateAction<number>>;
	versions: VersionsHook;
	selectedContent: ContentItem | null;
	versionsCompanies: Company[];
	versionsProjects: Project[];
	selection: SelectionHook;
	sharedTabKey: number;
	setSharedTabKey: Dispatch<SetStateAction<number>>;
	sharedContents: ShareResponse[];
	sharedLoading: boolean;
	handleSharedContentsRefresh: () => void;
	deepLink: DeepLinkHook;
	commentsTabKey: number;
	setCommentsTabKey: Dispatch<SetStateAction<number>>;
	selectedContentId: string | null;
	currentContentUserId: string;
	handleFileCommentsAfterUpdate: () => void;
	duplicatesTabKey: number;
	setDuplicatesTabKey: Dispatch<SetStateAction<number>>;
	handleDuplicateFinderChange: () => void;
	brokenFilesTabKey: number;
	setBrokenFilesTabKey: Dispatch<SetStateAction<number>>;
	handleBrokenFilesChange: () => void;
	resolveContentTypeLabel: (contentType: string) => string;
	folderMenuTarget: ReturnType<
		typeof import('./useContentManagerExplorerFolders').useContentManagerExplorerFolders
	>['folderMenuTarget'];
	folderMenuPos: { x: number; y: number } | null;
	closeFolderMenu: () => void;
	setExplorerFolderTarget: Dispatch<SetStateAction<'unfiled' | string>>;
	createFolderUnderParent: (parentItemId: string) => void | Promise<void>;
	renameExplorerFolder: (
		itemId: string,
		currentName: string
	) => void | Promise<void>;
	deleteExplorerFolder: (itemId: string, name: string) => void | Promise<void>;
	fetchFolders: () => void | Promise<void>;
	contentGuideOpen: boolean;
	setContentGuideOpen: Dispatch<SetStateAction<boolean>>;
	savedViewId: ContentManagerSavedViewId | null;
	advancedQuery: string;
	setAdvancedQuery: Dispatch<SetStateAction<string>>;
	advancedContentType: string;
	setAdvancedContentType: Dispatch<SetStateAction<string>>;
	advancedVisibility: import('../components/ContentManagerAdvancedSearch').AdvancedVisibilityFilter;
	setAdvancedVisibility: Dispatch<
		SetStateAction<
			import('../components/ContentManagerAdvancedSearch').AdvancedVisibilityFilter
		>
	>;
	advancedTags: string;
	setAdvancedTags: Dispatch<SetStateAction<string>>;
	advancedDateFrom: string;
	setAdvancedDateFrom: Dispatch<SetStateAction<string>>;
	advancedDateTo: string;
	setAdvancedDateTo: Dispatch<SetStateAction<string>>;
	advancedSizeMin: string;
	setAdvancedSizeMin: Dispatch<SetStateAction<string>>;
	advancedSizeMax: string;
	setAdvancedSizeMax: Dispatch<SetStateAction<string>>;
	contentTypeOptionsForAdvanced: Array<{ value: string; label: string }>;
	clearAdvancedSearch: () => void;
	runAdvancedSearchPage: (page: number) => void | Promise<void>;
	advancedLoading: boolean;
	hasAdvancedResults: boolean;
	advancedError: string | null;
	advancedResults: import('../../../services/contentApi').ContentAdvancedSearchHit[];
	advancedTotal: number;
	advancedPage: number;
	advancedTotalPages: number;
	setAdvancedResults: Dispatch<
		SetStateAction<
			import('../../../services/contentApi').ContentAdvancedSearchHit[]
		>
	>;
	setAdvancedTotal: Dispatch<SetStateAction<number>>;
	setAdvancedError: Dispatch<SetStateAction<string | null>>;
	setAdvancedPage: Dispatch<SetStateAction<number>>;
	bulkModals: BulkModalsHook;
	cabinetLocked: boolean;
	cabinetProjectLabel: string;
	setFilesBrowseMode: Dispatch<SetStateAction<FilesBrowseMode>>;
	folderTreeRoots: ReturnType<
		typeof import('./useContentManagerExplorerFolders').useContentManagerExplorerFolders
	>['folderTreeRoots'];
	explorerNestedFolders: ReturnType<
		typeof import('./useContentManagerExplorerFolders').useContentManagerExplorerFolders
	>['explorerNestedFolders'];
	openFolderMenu: ReturnType<
		typeof import('./useContentManagerExplorerFolders').useContentManagerExplorerFolders
	>['openFolderMenu'];
	searchQuery: string;
	setSearchMode: Dispatch<SetStateAction<'keyword' | 'hybrid'>>;
	searchMode: 'keyword' | 'hybrid';
	searchInputRef: RefObject<HTMLInputElement | null>;
	sortField: import('../contentManagerTypes').SortField;
	sortOrder: import('../contentManagerTypes').SortOrder;
	setSortField: Dispatch<
		SetStateAction<import('../contentManagerTypes').SortField>
	>;
	setSortOrder: Dispatch<
		SetStateAction<import('../contentManagerTypes').SortOrder>
	>;
	setCurrentPage: Dispatch<SetStateAction<number>>;
	currentPage: number;
	showFilters: boolean;
	setShowFilters: Dispatch<SetStateAction<boolean>>;
	showAdvancedSearch: boolean;
	setShowAdvancedSearch: Dispatch<SetStateAction<boolean>>;
	autoSort: AutoSortHook;
	viewMode: import('../contentManagerTypes').ViewMode;
	setViewMode: Dispatch<
		SetStateAction<import('../contentManagerTypes').ViewMode>
	>;
	filterFolderId: string | null;
	setFilterFolderId: Dispatch<SetStateAction<string | null>>;
	folders: ReturnType<
		typeof import('./useContentManagerExplorerFolders').useContentManagerExplorerFolders
	>['folders'];
	filterCompanyId: string | null;
	setFilterCompanyId: Dispatch<SetStateAction<string | null>>;
	companies: ReturnType<
		typeof import('./useTenancyOptions').useTenancyOptions
	>['companies'];
	loadingCompanies: boolean;
	filterProjectId: string | null;
	setFilterProjectId: Dispatch<SetStateAction<string | null>>;
	projects: ReturnType<
		typeof import('./useTenancyOptions').useTenancyOptions
	>['projects'];
	loadingProjects: boolean;
	filterType: string;
	setFilterType: Dispatch<SetStateAction<string>>;
	filterVisibility: import('../contentManagerTypes').FilterVisibility;
	setFilterVisibility: Dispatch<
		SetStateAction<import('../contentManagerTypes').FilterVisibility>
	>;
	filterTag: string | null;
	setFilterTag: Dispatch<SetStateAction<string | null>>;
	groupBy: import('../contentManagerTypes').GroupBy;
	setGroupBy: Dispatch<
		SetStateAction<import('../contentManagerTypes').GroupBy>
	>;
	setAssignCompanyId: Dispatch<SetStateAction<string>>;
	setAssignProjectId: Dispatch<SetStateAction<string>>;
	refreshProjects: ReturnType<
		typeof import('./useTenancyOptions').useTenancyOptions
	>['refreshProjects'];
	setAssignTenancyOpen: Dispatch<SetStateAction<boolean>>;
	explorerExpandedFolderIds: Set<string>;
	setExplorerExpandedFolderIds: Dispatch<SetStateAction<Set<string>>>;
	explorerDropHighlight: string | null;
	setExplorerDropHighlight: Dispatch<SetStateAction<string | null>>;
	onExplorerDropToFolder: ReturnType<
		typeof import('./useContentManagerExplorerFolders').useContentManagerExplorerFolders
	>['onExplorerDropToFolder'];
	contentListError: string | null;
	filteredItems: ContentItem[];
	filePanelGroups: FileGroupsHook['filePanelGroups'];
	handleAllFilesShowMoreInFolder: FileGroupsHook['onAllFilesShowMoreInFolder'];
	isMobile: boolean;
	gridFocusIndex: number;
	gridColumnCount: number;
	setGridColumnCount: Dispatch<SetStateAction<number>>;
	allFilesHasMore: boolean;
	allFilesLoadingMore: boolean;
	allFilesLoadedCount: number;
	allFilesLoadMore: () => void | Promise<void>;
	editForm: EditFormHook;
	friendsForEditQuery: FriendsQuery;
	assignTenancyOpen: boolean;
	assignTenancyLoading: boolean;
	assignCompanyId: string;
	assignProjectId: string;
};
