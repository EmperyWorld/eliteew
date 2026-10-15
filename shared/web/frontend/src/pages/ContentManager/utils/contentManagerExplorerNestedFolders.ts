/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy client-side nested-folder filter kept for unit regression of parent_item_id /
 * UUID matching. Runtime folder UI uses GET /api/v1/content/folder-view (not this helper).
 *
 * Invariants:
 * - Not the source of truth for CM explorer or desktop folder window after folder-view cutover.
 *
 * Related:
 * - hooks/useFolderView.ts · documentation/product/CONTENT-MANAGER.md
 */

import type { DesktopItemResponse } from '../../Desktop/services/desktopApi';
import type {
	ExplorerFolderTarget,
	FilesBrowseMode,
} from '../contentManagerTypes';

type DesktopFolderWireItem = DesktopItemResponse & {
	parent_item_id?: string | null;
};

export function resolveContentManagerExplorerNestedFolders(
	folders: readonly DesktopFolderWireItem[],
	filesBrowseMode: FilesBrowseMode,
	explorerFolderTarget: ExplorerFolderTarget,
	opts?: { search?: string }
): DesktopFolderWireItem[] {
	if (filesBrowseMode !== 'explorer') return [];
	if (explorerFolderTarget === 'unfiled' || !explorerFolderTarget.trim()) {
		return [];
	}

	const parent = folders.find((f) => f.item_id === explorerFolderTarget);
	const parentUuid =
		parent?.id != null && String(parent.id).trim() !== ''
			? String(parent.id)
			: null;

	let children = folders.filter((f) => {
		if (f.item_type !== 'FOLDER') return false;
		if (f.item_id === explorerFolderTarget) return false;
		const byWire =
			(f.parent_item_id ?? '').trim() === explorerFolderTarget.trim();
		const byUuid =
			parentUuid != null &&
			f.parent_id != null &&
			String(f.parent_id) === parentUuid;
		return byWire || byUuid;
	});

	const q = opts?.search?.trim().toLowerCase();
	if (q) {
		children = children.filter((f) => f.name.toLowerCase().includes(q));
	}

	return [...children].sort((a, b) =>
		a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
	);
}

export function isContentManagerSystemFolder(
	folder: Pick<DesktopItemResponse, 'item_id' | 'is_system'>
): boolean {
	return folder.is_system === true;
}
