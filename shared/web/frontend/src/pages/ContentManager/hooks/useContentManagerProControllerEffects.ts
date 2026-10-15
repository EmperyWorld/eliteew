/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Side-effect wiring for Content Manager Pro controller: scope bootstrap, refresh, pagination reset, deep-link open.
 *
 * Invariants:
 * - Page index resets when list filter inputs change; selection anchor clears when select mode exits.
 *
 * Related:
 * - useContentManagerProController.ts, useContentManagerInitialScope.ts
 */
import { useEffect } from 'react';
import type { TFunction } from 'i18next';
import type { ContentManagerInitialFilterSnapshot } from '../../Desktop/types/desktop.types';
import type { ContentManagerCabinetScope } from '../contentManagerProTypes';
import type {
	ExplorerFolderTarget,
	FilesBrowseMode,
	FilterVisibility,
	GroupBy,
	SortField,
	SortOrder,
} from '../contentManagerTypes';
import { useContentManagerInitialScope } from './useContentManagerInitialScope';
import { useContentManagerOpenContentEffects } from './useContentManagerOpenContentEffects';
import type { ContentManagerProControllerShellState } from './useContentManagerProControllerShellState';
import type { useContentManagerPreviewKeyboard } from './useContentManagerPreviewKeyboard';
import type { useContentManagerSelection } from './useContentManagerSelection';

type PreviewKeyboard = ReturnType<typeof useContentManagerPreviewKeyboard>;
type SelectionHook = ReturnType<typeof useContentManagerSelection>;

export type UseContentManagerProControllerEffectsParams = {
	shell: Pick<
		ContentManagerProControllerShellState,
		| 'activeTab'
		| 'setActiveTab'
		| 'currentPage'
		| 'setCurrentPage'
		| 'pendingOpenContentId'
		| 'setPendingOpenContentId'
		| 'setError'
		| 'setAssignTenancyOpen'
	>;
	initialCabinetScope: ContentManagerCabinetScope | null;
	initialDesktopFolderItemId: string | null;
	initialFilterSnapshot: ContentManagerInitialFilterSnapshot | null;
	initialFocusUnifiedContentId: string | null;
	initialOpenAssignProject: boolean;
	filterFolderId: string | null;
	filesBrowseMode: FilesBrowseMode;
	explorerFolderTarget: ExplorerFolderTarget;
	filterCompanyId: string | null;
	filterProjectId: string | null;
	searchQuery: string;
	filterType: string;
	filterVisibility: FilterVisibility;
	filterTag: string | null;
	sortField: SortField;
	sortOrder: SortOrder;
	setFilterCompanyId: React.Dispatch<React.SetStateAction<string | null>>;
	setFilterProjectId: React.Dispatch<React.SetStateAction<string | null>>;
	setFilterFolderId: React.Dispatch<React.SetStateAction<string | null>>;
	setFilesBrowseMode: React.Dispatch<React.SetStateAction<FilesBrowseMode>>;
	setGroupBy: React.Dispatch<React.SetStateAction<GroupBy>>;
	setExplorerFolderTarget: React.Dispatch<
		React.SetStateAction<ExplorerFolderTarget>
	>;
	setExplorerExpandedFolderIds: React.Dispatch<
		React.SetStateAction<Set<string>>
	>;
	setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
	setFilterType: React.Dispatch<React.SetStateAction<string>>;
	setFilterVisibility: React.Dispatch<React.SetStateAction<FilterVisibility>>;
	fetchFolders: () => void | Promise<void>;
	refreshProjects: (companyId: string | null) => void | Promise<void>;
	fetchContent: () => void | Promise<void>;
	fetchStats: () => void | Promise<void>;
	items: import('../../../components/UnifiedContent/types').Content[];
	selection: SelectionHook;
	preview: PreviewKeyboard;
	t: TFunction<'contentManager'>;
	onOpenAssignProject: () => void;
	onContentOpened: (
		item: import('../../../components/UnifiedContent/types').Content
	) => void;
};

export function useContentManagerProControllerEffects({
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
	onOpenAssignProject,
	onContentOpened,
}: UseContentManagerProControllerEffectsParams): void {
	useEffect(() => {
		fetchFolders();
	}, [fetchFolders]);

	useContentManagerInitialScope({
		initialCabinetScope,
		initialDesktopFolderItemId,
		initialFilterSnapshot,
		fetchFolders,
		setActiveTab: shell.setActiveTab,
		setCurrentPage: shell.setCurrentPage,
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
	});

	useEffect(() => {
		void refreshProjects(filterCompanyId);
	}, [filterCompanyId, refreshProjects]);

	useEffect(() => {
		const onVisibilityChange = () => {
			if (
				document.visibilityState === 'visible' &&
				shell.activeTab === 'files'
			) {
				fetchContent();
				fetchStats();
			}
		};
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () =>
			document.removeEventListener('visibilitychange', onVisibilityChange);
	}, [shell.activeTab, fetchContent, fetchStats]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: run when any listed filter/sort input changes (setCurrentPage is stable)
	useEffect(() => {
		shell.setCurrentPage(1);
	}, [
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
	]);

	useContentManagerOpenContentEffects({
		items,
		pendingOpenContentId: shell.pendingOpenContentId,
		setPendingOpenContentId: shell.setPendingOpenContentId,
		setSelectedIds: selection.setSelectedIds,
		setPreviewItem: preview.setPreviewItem,
		setError: shell.setError,
		t,
		initialFocusUnifiedContentId,
		initialOpenAssignProject,
		onOpenAssignProject,
		onContentOpened,
	});

	useEffect(() => {
		if (!selection.selectMode) {
			selection.selectionAnchorIndexRef.current = null;
		}
	}, [selection.selectMode, selection.selectionAnchorIndexRef]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: сброс якоря Shift-диапазона при смене страницы
	useEffect(() => {
		selection.resetSelectionOnPageChange();
	}, [shell.currentPage, selection.resetSelectionOnPageChange]);
}
