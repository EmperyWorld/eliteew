/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Resolves the desktop-folder target for Content Manager uploads.
 *
 * Invariants:
 * - Explorer mode uploads into the currently selected desktop folder.
 * - Catalog mode uploads into the active catalog folder filter when set.
 * - Catalog/all-files default to `documents` when no explicit folder is selected.
 *
 * Related:
 * - `ContentManagerPro.tsx`
 * - `documentation/product/CONTENT-MANAGER.md`
 */
import type {
	ExplorerFolderTarget,
	FilesBrowseMode,
} from '../contentManagerTypes';

/** Default desktop folder for CM uploads when no explorer/catalog folder is selected. */
export const CONTENT_MANAGER_DEFAULT_UPLOAD_FOLDER = 'documents';

export function resolveContentManagerUploadFolderItemId(
	filesBrowseMode: FilesBrowseMode,
	explorerFolderTarget: ExplorerFolderTarget,
	catalogFolderFilterId?: string | null
): string | null {
	if (filesBrowseMode === 'explorer') {
		const target = explorerFolderTarget.trim();
		if (!target || target === 'unfiled') return null;
		return target;
	}
	if (filesBrowseMode === 'catalog') {
		const folder = catalogFolderFilterId?.trim();
		return folder || CONTENT_MANAGER_DEFAULT_UPLOAD_FOLDER;
	}
	if (filesBrowseMode === 'all_files') {
		return CONTENT_MANAGER_DEFAULT_UPLOAD_FOLDER;
	}
	return null;
}
