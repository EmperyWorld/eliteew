/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public props contract for Content Manager Files tab; keeps orchestration in parent.
 *
 * Invariants:
 * - Bulk actions operate only on currently selected visible file ids.
 *
 * Related:
 * - `ContentManagerFilesTab.tsx`
 * - `ContentManagerProFilesTabBridge.tsx`
 */
import type * as React from 'react';
import type { Content as ContentItem } from '../../components/UnifiedContent/types';
import type { DesktopItemResponse } from '../Desktop/services/desktopApi';
import type { ContentManagerEditFolderOption } from './components/ContentManagerEditModal';
import type {
	ContentManagerFilePanelGroup,
	ContentManagerFolderTreeNode,
	ExplorerFolderTarget,
	FilesBrowseMode,
	FilterVisibility,
	GroupBy,
	SortField,
	SortOrder,
	ViewMode,
} from './contentManagerTypes';
import type { TenancyCompany, TenancyProject } from './hooks/useTenancyOptions';
import type { AutoSortScope } from './sortToSystemFolders';
import type { ContentDragPayload } from './utils/contentManagerDrag';

export interface ContentManagerFilesTabProps {
	embedded: boolean;
	/** MobileAndroid embedded WebView — column split, not Tailwind `md:` row. */
	embeddedMobileLayout?: boolean;
	/**
	 * Когда задано (desktop-окно): шапка, вкладки и глобальные действия — в левой колонке;
	 * справа на всю высоту — только список файлов.
	 */
	filesLeadingChrome?: React.ReactNode;
	/** Вкладки разделов над сеткой (`ContentManagerTabStrip` `railIconRow`). */
	filesPanelTabsSlot?: React.ReactNode;
	/** Библиотека (действия) в split-лейауте — после разделов. */
	filesLibraryChrome?: React.ReactNode;
	uploading?: boolean;
	downloadingOwnedArchive?: boolean;
	statsLoading?: boolean;
	ownedFilesCount?: number;
	onDownloadOwnedArchive?: () => void;
	shellContentPanelClass: string;
	cabinetLocked: boolean;
	cabinetProjectLabel: string;
	explorerContextPlaceLabel: string;
	filesBrowseMode: FilesBrowseMode;
	setFilesBrowseMode: React.Dispatch<React.SetStateAction<FilesBrowseMode>>;
	folderTreeRoots: ContentManagerFolderTreeNode[];
	explorerNestedFolders: DesktopItemResponse[];
	onOpenExplorerFolder: (itemId: string) => void;
	onFolderContextMenu: (
		event: React.MouseEvent,
		folder: DesktopItemResponse
	) => void;
	onRequestFolderMenu: (
		event: React.MouseEvent,
		folder: ContentManagerFolderTreeNode
	) => void;
	onCreateFolderInCurrent?: () => void;
	searchQuery: string;
	setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
	searchMode: 'keyword' | 'hybrid';
	setSearchMode: React.Dispatch<React.SetStateAction<'keyword' | 'hybrid'>>;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	sortField: SortField;
	sortOrder: SortOrder;
	setSortField: React.Dispatch<React.SetStateAction<SortField>>;
	setSortOrder: React.Dispatch<React.SetStateAction<SortOrder>>;
	setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
	showFilters: boolean;
	setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
	showAdvancedSearch: boolean;
	setShowAdvancedSearch: React.Dispatch<React.SetStateAction<boolean>>;
	autoSortBusy: boolean;
	loading: boolean;
	runAutoSortToSystemFolders: (scope: AutoSortScope) => void | Promise<void>;
	viewMode: ViewMode;
	setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
	selectMode: boolean;
	setSelectMode: React.Dispatch<React.SetStateAction<boolean>>;
	selectedIds: ReadonlySet<string>;
	setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	filterFolderId: string | null;
	setFilterFolderId: React.Dispatch<React.SetStateAction<string | null>>;
	folders: ContentManagerEditFolderOption[];
	filterCompanyId: string | null;
	setFilterCompanyId: React.Dispatch<React.SetStateAction<string | null>>;
	companies: TenancyCompany[];
	loadingCompanies: boolean;
	filterProjectId: string | null;
	setFilterProjectId: React.Dispatch<React.SetStateAction<string | null>>;
	projects: TenancyProject[];
	loadingProjects: boolean;
	filterType: string;
	setFilterType: React.Dispatch<React.SetStateAction<string>>;
	filterVisibility: FilterVisibility;
	setFilterVisibility: React.Dispatch<React.SetStateAction<FilterVisibility>>;
	filterTag: string | null;
	setFilterTag: React.Dispatch<React.SetStateAction<string | null>>;
	groupBy: GroupBy;
	setGroupBy: React.Dispatch<React.SetStateAction<GroupBy>>;
	advancedSearchSlot: React.ReactNode;
	selectAll: () => void;
	batchDownload: () => void | Promise<void>;
	batchDownloadLoading: boolean;
	batchCopy: () => void | Promise<void>;
	batchCopyLoading: boolean;
	batchMove?: () => void;
	batchDelete: () => void | Promise<void>;
	setAssignCompanyId: React.Dispatch<React.SetStateAction<string>>;
	setAssignProjectId: React.Dispatch<React.SetStateAction<string>>;
	refreshProjects: (companyId: string | null) => void | Promise<void>;
	setAssignTenancyOpen: React.Dispatch<React.SetStateAction<boolean>>;
	explorerFolderTarget: ExplorerFolderTarget;
	setExplorerFolderTarget: React.Dispatch<
		React.SetStateAction<ExplorerFolderTarget>
	>;
	explorerExpandedFolderIds: ReadonlySet<string>;
	setExplorerExpandedFolderIds: React.Dispatch<
		React.SetStateAction<Set<string>>
	>;
	explorerDropHighlight: 'unfiled' | string | null;
	setExplorerDropHighlight: React.Dispatch<
		React.SetStateAction<'unfiled' | string | null>
	>;
	onExplorerDropToFolder: (
		e: React.DragEvent,
		targetFolderItemId: string | null
	) => void | Promise<void>;
	contentListError: string | null;
	fetchContent: () => void | Promise<void>;
	filteredItems: ContentItem[];
	filePanelGroups: ContentManagerFilePanelGroup[];
	filesEmptyStateCopy: { title: string; description: string };
	hasActiveListFilters: boolean;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	isMobile: boolean;
	/** Open preview + history; stable ref for memoized FileCard/FileRow */
	viewGridFile: (item: ContentItem) => void;
	downloadFile: (id: string, name: string) => void | Promise<void>;
	reprocessContentDisplay?: (id: string, name: string) => void | Promise<void>;
	deleteFile: (id: string) => void | Promise<void>;
	openEdit: (item: ContentItem) => void;
	inlinePreviewId: string | null;
	inlinePreviewUrl: string | null;
	handleToggleInlinePreview: (id: string) => void;
	resolveDragContentIds: (itemId: string) => string[];
	/** Rich drag payload (ids + labels) for desktop drop metadata */
	resolveContentDragPayload?: (itemId: string) => ContentDragPayload;
	gridFocusIndex: number;
	handleGridArrowNavigate: (key: string, itemId: string) => void;
	toggleSelection: (
		id: string,
		opts?: { shiftKey?: boolean; index?: number; fromCheckbox?: boolean }
	) => void;
	copyContentLink: (id: string) => void | Promise<void>;
	copyFile: (item: ContentItem) => void;
	onMoveFile?: (id: string) => void;
	/** «Все файлы» + группировка по папке: догрузить файлы в группе. */
	onAllFilesShowMoreInFolder?: (groupId: string) => void;
	totalItems: number;
	currentPage: number;
	/** «Все файлы»: cursor paging footer (optional — catalog/explorer omit). */
	allFilesHasMore?: boolean;
	allFilesLoadingMore?: boolean;
	allFilesLoadedCount?: number;
	allFilesLoadMore?: () => void | Promise<void>;
	/** Columns in grid; updated from measured container width for keyboard navigation */
	gridColumnCount: number;
	setGridColumnCount: React.Dispatch<React.SetStateAction<number>>;
}
