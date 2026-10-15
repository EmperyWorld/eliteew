/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Pure UX resolvers for Content Manager list filters and bulk-selection copy.
 *
 * Invariants:
 * - Explorer folder navigation is not treated as a user refinement/filter.
 * - Selection labels describe the visible client-side scope, not hidden API pages.
 *
 * Related:
 * - `ContentManagerPro.tsx`
 * - `ContentManagerFilesTab.tsx`
 */
import type {
	FilesBrowseMode,
	FilterVisibility,
	GroupBy,
} from '../contentManagerTypes';

export interface ContentManagerListFilterState {
	searchQuery: string;
	filterType: string;
	filterVisibility: FilterVisibility;
	filterTag?: string | null;
	filesBrowseMode: FilesBrowseMode;
	filterFolderId: string | null;
	filterCompanyId: string | null;
	filterProjectId: string | null;
}

export interface ContentManagerSelectionCopy {
	selectAllKey: string;
	selectAllTitleKey: string;
	bulkHintKey: string;
}

export function hasContentManagerActiveListFilters({
	searchQuery,
	filterType,
	filterVisibility,
	filterTag = null,
	filesBrowseMode,
	filterFolderId,
	filterCompanyId,
	filterProjectId,
}: ContentManagerListFilterState): boolean {
	return Boolean(
		searchQuery.trim() ||
			filterType !== 'all' ||
			filterVisibility !== 'all' ||
			Boolean(filterTag?.trim()) ||
			(filesBrowseMode === 'catalog' && filterFolderId) ||
			filterCompanyId ||
			filterProjectId
	);
}

export function resolveContentManagerSelectionCopy(
	filesBrowseMode: FilesBrowseMode,
	groupBy: GroupBy
): ContentManagerSelectionCopy {
	if (filesBrowseMode === 'all_files' || groupBy !== 'none') {
		return {
			selectAllKey: 'files.selection.selectAllVisible',
			selectAllTitleKey: 'files.toolbar.selectAllVisibleTitle',
			bulkHintKey: 'files.selection.bulkHintVisible',
		};
	}

	return {
		selectAllKey: 'files.selection.selectAll',
		selectAllTitleKey: 'files.toolbar.selectAllOnPageTitle',
		bulkHintKey: 'files.selection.bulkHint',
	};
}
