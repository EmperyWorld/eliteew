/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derived files-tab UX state: saved views, empty copy, explorer labels, preview viewport, select-all.
 *
 * Invariants:
 * - Embedded preview viewport locks outer desktop scroll container while modal is open.
 *
 * Related:
 * - ContentManagerPro.tsx, useContentManagerSavedViews.ts
 */
import type {
	Dispatch,
	MutableRefObject,
	RefObject,
	SetStateAction,
} from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import type { DesktopItemResponse } from '../../Desktop/services/desktopApi';
import { resolveDesktopFolderDisplayName } from '../../Desktop/utils/desktopSystemFolderLabels';
import type {
	ContentManagerTab,
	FilesBrowseMode,
	FilterVisibility,
	SortField,
	SortOrder,
} from '../contentManagerTypes';
import { hasContentManagerActiveListFilters } from '../utils/contentManagerListUx';
import type { ContentManagerSavedViewId } from './useContentManagerSavedViews';

export type UseContentManagerFilesUiDerivedParams = {
	t: TFunction<'contentManager'>;
	embedded: boolean;
	previewItem: ContentItem | null;
	rootRef: RefObject<HTMLElement | null>;
	activeTab: ContentManagerTab;
	searchQuery: string;
	filterType: string;
	filterVisibility: FilterVisibility;
	filterTag: string | null;
	filesBrowseMode: FilesBrowseMode;
	filterFolderId: string | null;
	filterCompanyId: string | null;
	filterProjectId: string | null;
	explorerFolderTarget: string;
	desktopFolderItems: DesktopItemResponse[];
	filteredItems: ContentItem[];
	setActiveTab: Dispatch<SetStateAction<ContentManagerTab>>;
	setCurrentPage: Dispatch<SetStateAction<number>>;
	setSearchQuery: Dispatch<SetStateAction<string>>;
	setFilterTag: Dispatch<SetStateAction<string | null>>;
	setFilterFolderId: Dispatch<SetStateAction<string | null>>;
	setClientMinFileSize: Dispatch<SetStateAction<number | null>>;
	setClientProcessingStatusFilter: Dispatch<SetStateAction<string | null>>;
	setFilesBrowseMode: Dispatch<SetStateAction<FilesBrowseMode>>;
	setExplorerFolderTarget: Dispatch<SetStateAction<'unfiled' | string>>;
	setFilterVisibility: Dispatch<SetStateAction<FilterVisibility>>;
	setFilterType: Dispatch<SetStateAction<string>>;
	setSortField: Dispatch<SetStateAction<SortField>>;
	setSortOrder: Dispatch<SetStateAction<SortOrder>>;
	applySavedView: (id: ContentManagerSavedViewId) => {
		minFileSize?: number | null;
		processingStatus?: string | null;
		folderUnassignedOnly?: boolean;
		filterVisibility?: FilterVisibility;
		filterType?: string;
		sortField?: SortField;
		sortOrder?: SortOrder;
	};
	clearSavedView: () => void;
	setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
	selectionAnchorIndexRef: MutableRefObject<number | null>;
};

export function useContentManagerFilesUiDerived({
	t,
	embedded,
	previewItem,
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
	filteredItems,
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
	setSelectedIds,
	selectionAnchorIndexRef,
}: UseContentManagerFilesUiDerivedParams) {
	const { t: tDesktopUi } = useTranslation('desktopUi');
	const [previewViewport, setPreviewViewport] = useState<{
		top: number;
		height: number;
	} | null>(null);

	const showEmbeddedFilesSplit = embedded && activeTab === 'files';

	const handleSavedViewSelect = useCallback(
		(id: ContentManagerSavedViewId) => {
			const filters = applySavedView(id);
			setActiveTab('files');
			setCurrentPage(1);
			setSearchQuery('');
			setFilterTag(null);
			setClientMinFileSize(filters.minFileSize ?? null);
			setClientProcessingStatusFilter(filters.processingStatus ?? null);
			if (filters.folderUnassignedOnly) {
				setFilesBrowseMode('explorer');
				setExplorerFolderTarget('unfiled');
				setFilterFolderId(null);
			} else {
				setFilesBrowseMode('catalog');
				setExplorerFolderTarget('unfiled');
				setFilterFolderId(null);
			}
			setFilterVisibility(filters.filterVisibility ?? 'all');
			setFilterType(filters.filterType ?? 'all');
			if (filters.sortField) {
				setSortField(filters.sortField);
			}
			if (filters.sortOrder) {
				setSortOrder(filters.sortOrder);
			}
		},
		[
			applySavedView,
			setActiveTab,
			setCurrentPage,
			setSearchQuery,
			setFilterTag,
			setFilterFolderId,
			setSortField,
			setFilterVisibility,
			setFilterType,
			setSortOrder,
			setFilesBrowseMode,
			setExplorerFolderTarget,
			setClientMinFileSize,
			setClientProcessingStatusFilter,
		]
	);

	const handleSavedViewClear = useCallback(() => {
		clearSavedView();
		setCurrentPage(1);
		setSearchQuery('');
		setFilterTag(null);
		setClientMinFileSize(null);
		setClientProcessingStatusFilter(null);
		setFilterType('all');
		setFilterVisibility('all');
		setFilterFolderId(null);
		setExplorerFolderTarget('unfiled');
	}, [
		clearSavedView,
		setCurrentPage,
		setSearchQuery,
		setFilterTag,
		setFilterFolderId,
		setExplorerFolderTarget,
		setFilterVisibility,
		setFilterType,
		setClientMinFileSize,
		setClientProcessingStatusFilter,
	]);

	const hasActiveListFilters = useMemo(
		() =>
			hasContentManagerActiveListFilters({
				searchQuery,
				filterType,
				filterVisibility,
				filterTag,
				filesBrowseMode,
				filterFolderId,
				filterCompanyId,
				filterProjectId,
			}),
		[
			searchQuery,
			filterType,
			filterVisibility,
			filterTag,
			filesBrowseMode,
			filterFolderId,
			filterCompanyId,
			filterProjectId,
		]
	);

	const explorerSelectedFolderName = useMemo(() => {
		if (explorerFolderTarget === 'unfiled') return null;
		const folder = desktopFolderItems.find(
			(f) => f.item_id === explorerFolderTarget
		);
		return folder ? resolveDesktopFolderDisplayName(folder, tDesktopUi) : null;
	}, [desktopFolderItems, explorerFolderTarget, tDesktopUi]);

	const explorerContextPlaceLabel = useMemo(() => {
		if (explorerFolderTarget === 'unfiled') return t('explorer.unfiled');
		return explorerSelectedFolderName ?? t('explorer.folderFallbackName');
	}, [explorerFolderTarget, explorerSelectedFolderName, t]);

	const filesEmptyStateCopy = useMemo(() => {
		if (hasActiveListFilters) {
			return {
				title: t('files.list.emptyFilteredTitle'),
				description: t('files.list.emptyFilteredDesc'),
			};
		}
		if (filesBrowseMode === 'all_files') {
			return {
				title: t('files.list.emptyAllFilesTitle'),
				description: t('files.list.emptyAllFilesDesc'),
			};
		}
		if (filesBrowseMode === 'explorer') {
			if (explorerFolderTarget === 'unfiled') {
				return {
					title: t('explorer.emptyUnfiledTitle'),
					description: t('explorer.emptyUnfiledDesc'),
				};
			}
			return {
				title: t('explorer.emptyFolderTitle'),
				description: t('explorer.emptyFolderDesc', {
					folder:
						explorerSelectedFolderName ?? t('explorer.folderFallbackName'),
				}),
			};
		}
		return {
			title: t('files.list.emptyTitle'),
			description: t('files.list.emptyDesc'),
		};
	}, [
		hasActiveListFilters,
		filesBrowseMode,
		explorerFolderTarget,
		explorerSelectedFolderName,
		t,
	]);

	const prepareContentGuideStep = useCallback(
		(stepId: string) => {
			if (
				stepId === 'files-search-toolbar' ||
				stepId === 'files-panel' ||
				stepId === 'files-panel-toolbar'
			) {
				setActiveTab('files');
			}
		},
		[setActiveTab]
	);

	const selectAll = useCallback(() => {
		setSelectedIds((prev) => {
			const allOnPage = filteredItems.map((i) => i.id);
			const allSelected =
				allOnPage.length > 0 && allOnPage.every((id) => prev.has(id));
			if (allSelected) {
				selectionAnchorIndexRef.current = null;
				return new Set();
			}
			selectionAnchorIndexRef.current = 0;
			return new Set(allOnPage);
		});
	}, [filteredItems, setSelectedIds, selectionAnchorIndexRef]);

	useEffect(() => {
		if (!embedded || !previewItem) {
			setPreviewViewport(null);
			return;
		}

		const rootEl = rootRef.current;
		if (!rootEl) return;
		const desktopWindow = rootEl.closest<HTMLElement>('[data-desktop-window]');
		if (!desktopWindow) return;
		const scrollContainer = desktopWindow.querySelector<HTMLElement>(
			'[data-desktop-scroll="true"]'
		);
		if (!scrollContainer) return;

		const height = scrollContainer.clientHeight || scrollContainer.offsetHeight;
		const top = scrollContainer.scrollTop;
		setPreviewViewport({ top, height });

		const prevOverflow = scrollContainer.style.overflow;
		scrollContainer.style.overflow = 'hidden';
		return () => {
			scrollContainer.style.overflow = prevOverflow || '';
		};
	}, [embedded, previewItem, rootRef]);

	return {
		previewViewport,
		showEmbeddedFilesSplit,
		handleSavedViewSelect,
		handleSavedViewClear,
		hasActiveListFilters,
		explorerSelectedFolderName,
		explorerContextPlaceLabel,
		filesEmptyStateCopy,
		prepareContentGuideStep,
		selectAll,
	} as const;
}
