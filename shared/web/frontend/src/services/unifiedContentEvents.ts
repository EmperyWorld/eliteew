/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Global `window` event names and helpers for **unified content** UX: blob updates (replace-file) and **library list
 * refresh** (e.g. after EWA companion create/rename/delete) so Content Manager refetches without manual «Обновить»;
 * plus desktop **items** refresh when another surface mutates folders via `/desktop/items`.
 *
 * Invariants:
 * - All dispatch helpers no-op without `window`; errors from `dispatchEvent` are swallowed.
 *
 * Related:
 * - `ContentManagerPro.tsx`, `useDocumentFileExchange.ts`, `EwaCompanionChatPanel.tsx`
 * - `useDesktopStorage.ts` (DESKTOP_ITEMS_REFRESH_EVENT)
 */

/** Событие после replace-file / обновления тела unified_content (тот же id). */
export const UNIFIED_CONTENT_BLOB_UPDATED_EVENT =
	'eliteew-unified-content-blob-updated';

export type UnifiedContentBlobUpdatedDetail = {
	contentId: string;
	updated_at: string;
	file_size: number | null;
};

/**
 * Просит открытый **Content Manager** перезагрузить список библиотеки (`fetchContent`), как после нажатия «Обновить».
 */
export const CONTENT_MANAGER_LIBRARY_REFRESH_EVENT =
	'eliteew-content-manager-library-refresh';

/** Desktop folder icon badges: refresh Unified Content totals (optional folder id list). */
export const DESKTOP_FOLDER_LIBRARY_COUNTS_INVALIDATE_EVENT =
	'eliteew-desktop-folder-library-counts-invalidate';

/**
 * Просит рабочий стол перезагрузить `desktop_items` (иконки / окно EvaFile), когда папки
 * создали/переименовали/удалили из Content Manager или другого окна без `useDesktopStorage.deleteItem`.
 * Optional ``removedItemIds``: drop from in-memory snapshot immediately so a pending
 * bulk ``PUT /desktop/items`` cannot resurrect rows already deleted on the server.
 */
export const DESKTOP_ITEMS_REFRESH_EVENT = 'eliteew-desktop-items-refresh';

export type DesktopFolderLibraryCountsInvalidateDetail = {
	folderIds?: string[];
};

export type DesktopItemsRefreshDetail = {
	removedItemIds?: string[];
};

export function requestContentManagerLibraryRefresh(): void {
	if (typeof window === 'undefined') return;
	try {
		window.dispatchEvent(
			new CustomEvent(CONTENT_MANAGER_LIBRARY_REFRESH_EVENT)
		);
	} catch {
		/* ignore */
	}
}

export function requestDesktopFolderLibraryCountsInvalidate(
	detail?: DesktopFolderLibraryCountsInvalidateDetail
): void {
	if (typeof window === 'undefined') return;
	try {
		window.dispatchEvent(
			new CustomEvent(DESKTOP_FOLDER_LIBRARY_COUNTS_INVALIDATE_EVENT, {
				detail: detail ?? {},
			})
		);
	} catch {
		/* ignore */
	}
}

export function requestDesktopItemsRefresh(
	detail?: DesktopItemsRefreshDetail
): void {
	if (typeof window === 'undefined') return;
	try {
		window.dispatchEvent(
			new CustomEvent(DESKTOP_ITEMS_REFRESH_EVENT, {
				detail: detail ?? {},
			})
		);
	} catch {
		/* ignore */
	}
}
