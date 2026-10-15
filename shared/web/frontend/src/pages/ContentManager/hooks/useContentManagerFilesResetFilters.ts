/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resets list filters and explorer scope to defaults for empty-state recovery.
 *
 * Invariants:
 * - Resets pagination to page 1.
 *
 * Related:
 * - `ContentManagerFilesTab.tsx`
 */
import * as React from 'react';
import type {
	ExplorerFolderTarget,
	FilterVisibility,
} from '../contentManagerTypes';

export function useContentManagerFilesResetFilters(args: {
	setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
	setFilterType: React.Dispatch<React.SetStateAction<string>>;
	setFilterVisibility: React.Dispatch<React.SetStateAction<FilterVisibility>>;
	setFilterFolderId: React.Dispatch<React.SetStateAction<string | null>>;
	setExplorerFolderTarget: React.Dispatch<
		React.SetStateAction<ExplorerFolderTarget>
	>;
	setFilterCompanyId: React.Dispatch<React.SetStateAction<string | null>>;
	setFilterProjectId: React.Dispatch<React.SetStateAction<string | null>>;
	setFilterTag: React.Dispatch<React.SetStateAction<string | null>>;
	setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}): () => void {
	const {
		setSearchQuery,
		setFilterType,
		setFilterVisibility,
		setFilterFolderId,
		setExplorerFolderTarget,
		setFilterCompanyId,
		setFilterProjectId,
		setFilterTag,
		setCurrentPage,
	} = args;

	return React.useCallback(() => {
		setSearchQuery('');
		setFilterType('all');
		setFilterVisibility('all');
		setFilterFolderId(null);
		setExplorerFolderTarget('unfiled');
		setFilterCompanyId(null);
		setFilterProjectId(null);
		setFilterTag(null);
		setCurrentPage(1);
	}, [
		setCurrentPage,
		setExplorerFolderTarget,
		setFilterCompanyId,
		setFilterFolderId,
		setFilterProjectId,
		setFilterTag,
		setFilterType,
		setFilterVisibility,
		setSearchQuery,
	]);
}
