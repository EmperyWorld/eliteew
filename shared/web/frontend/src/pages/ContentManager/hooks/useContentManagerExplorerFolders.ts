/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns Content Manager explorer folder discovery, nested tree state, folder CRUD, and content-to-folder drag moves.
 *
 * Invariants:
 * - Folder mutations refresh both Content Manager state and desktop item consumers.
 * - Project-folder moves preserve tenancy through buildContentMoveScopePatch.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - components/ContentManagerFolderContextMenu.tsx
 * - services/unifiedContentEvents.ts
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { notify } from '../../../notifications';
import {
	contentApi,
	type FolderViewDesktopChild,
} from '../../../services/contentApi';
import {
	DESKTOP_ITEMS_REFRESH_EVENT,
	requestDesktopFolderLibraryCountsInvalidate,
	requestDesktopItemsRefresh,
} from '../../../services/unifiedContentEvents';
import { getApiErrorMessage } from '../../../utils/apiError';
import { log } from '../../../utils/logger';
import { collectFolderIdsForLibraryMutation } from '../../Desktop/utils/desktopFolderLibraryCounts';
import {
	deleteDesktopItem,
	getDesktopItems,
	type DesktopItemResponse,
	updateDesktopItem,
	upsertDesktopItem,
} from '../../Desktop/services/desktopApi';
import type {
	ContentManagerFolderTreeNode,
	ExplorerFolderTarget,
	FilesBrowseMode,
} from '../contentManagerTypes';
import type { ContentManagerFolderMenuTarget } from '../components/ContentManagerFolderContextMenu';
import type { ContentManagerEditFolderOption } from '../components/ContentManagerEditModal';
import type { TenancyProject } from './useTenancyOptions';
import { parseContentDragIds } from '../utils/contentManagerDrag';
import { buildContentMoveScopePatch } from '../utils/contentManagerFolderScopePatch';
import { getContentRecoveryHint } from '../utils/contentManagerProRecovery';

export type UseContentManagerExplorerFoldersOptions = {
	t: TFunction<'contentManager'>;
	items: ContentItem[];
	projects: TenancyProject[];
	filesBrowseMode: FilesBrowseMode;
	explorerFolderTarget: ExplorerFolderTarget;
	setExplorerFolderTarget: React.Dispatch<
		React.SetStateAction<ExplorerFolderTarget>
	>;
	folderViewDesktopChildren: FolderViewDesktopChild[];
	fetchContent: () => void | Promise<void>;
	fetchStats: () => void | Promise<void>;
	fetchManagerActivity: () => void | Promise<void>;
};

export function useContentManagerExplorerFolders({
	t,
	items,
	projects,
	filesBrowseMode,
	explorerFolderTarget,
	setExplorerFolderTarget,
	folderViewDesktopChildren,
	fetchContent,
	fetchStats,
	fetchManagerActivity,
}: UseContentManagerExplorerFoldersOptions) {
	const [folders, setFolders] = useState<ContentManagerEditFolderOption[]>([]);
	const [desktopFolderItems, setDesktopFolderItems] = useState<
		DesktopItemResponse[]
	>([]);
	const [explorerExpandedFolderIds, setExplorerExpandedFolderIds] = useState<
		Set<string>
	>(() => new Set());
	const [explorerDropHighlight, setExplorerDropHighlight] = useState<
		'unfiled' | string | null
	>(null);
	const [folderMenuTarget, setFolderMenuTarget] =
		useState<ContentManagerFolderMenuTarget | null>(null);
	const [folderMenuPos, setFolderMenuPos] = useState<{
		x: number;
		y: number;
	} | null>(null);

	const explorerNestedFolders = useMemo(() => {
		if (filesBrowseMode !== 'explorer') {
			return [];
		}
		if (explorerFolderTarget !== 'unfiled') {
			return folderViewDesktopChildren.filter(
				(item) => item.item_type === 'FOLDER'
			) as unknown as DesktopItemResponse[];
		}
		return desktopFolderItems.filter(
			(folder) =>
				folder.item_type === 'FOLDER' &&
				(folder.parent_id == null || String(folder.parent_id).trim() === '')
		);
	}, [
		desktopFolderItems,
		explorerFolderTarget,
		filesBrowseMode,
		folderViewDesktopChildren,
	]);

	const folderTreeRoots = useMemo((): ContentManagerFolderTreeNode[] => {
		const byParent = new Map<string | null, DesktopItemResponse[]>();
		for (const folder of desktopFolderItems) {
			const parentId =
				folder.parent_id != null && String(folder.parent_id).trim() !== ''
					? String(folder.parent_id)
					: null;
			if (!byParent.has(parentId)) byParent.set(parentId, []);
			byParent.get(parentId)?.push(folder);
		}
		for (const children of byParent.values()) {
			children.sort((a, b) =>
				a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
			);
		}
		const build = (parentUuid: string | null): ContentManagerFolderTreeNode[] =>
			(byParent.get(parentUuid) ?? []).map((folder) => ({
				...folder,
				children: build(String(folder.id)),
			}));
		return build(null);
	}, [desktopFolderItems]);

	useEffect(() => {
		setExplorerExpandedFolderIds(
			new Set(folderTreeRoots.map((r) => r.item_id))
		);
	}, [folderTreeRoots]);

	const fetchFolders = useCallback(async () => {
		try {
			const desktopItems = await getDesktopItems();
			const onlyFolders = desktopItems.filter(
				(item) => item.item_type === 'FOLDER'
			);
			setDesktopFolderItems(onlyFolders);
			setFolders(
				onlyFolders.map((folder) => ({
					item_id: folder.item_id,
					name: folder.name,
					is_system: folder.is_system,
					system_key: folder.system_key ?? null,
				}))
			);
		} catch (error) {
			log.warn(
				'useContentManagerExplorerFolders',
				`fetchFolders: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}, []);

	useEffect(() => {
		void fetchFolders();
	}, [fetchFolders]);

	useEffect(() => {
		const onDesktopItemsRefresh = () => {
			void fetchFolders();
		};
		window.addEventListener(DESKTOP_ITEMS_REFRESH_EVENT, onDesktopItemsRefresh);
		return () =>
			window.removeEventListener(
				DESKTOP_ITEMS_REFRESH_EVENT,
				onDesktopItemsRefresh
			);
	}, [fetchFolders]);

	const openFolderMenu = useCallback(
		(event: React.MouseEvent, folder: ContentManagerFolderMenuTarget) => {
			event.preventDefault();
			event.stopPropagation();
			setFolderMenuTarget(folder);
			setFolderMenuPos({ x: event.clientX, y: event.clientY });
		},
		[]
	);
	const closeFolderMenu = useCallback(() => {
		setFolderMenuTarget(null);
		setFolderMenuPos(null);
	}, []);

	const createFolderUnderParent = useCallback(
		async (parentItemId: string) => {
			const parent = desktopFolderItems.find(
				(folder) => folder.item_id === parentItemId
			);
			if (!parent) return;
			const name = window
				.prompt(t('explorer.newFolderPrompt'), t('explorer.newFolderDefault'))
				?.trim();
			if (!name) return;
			const itemId = `folder-${Date.now()}`;
			try {
				const nestedFolderPayload = {
					item_id: itemId,
					item_type: 'FOLDER',
					name,
					position: { x: 20, y: 20 },
					is_pinned: false,
					parent_id: String(parent.id),
					parent_item_id: parent.item_id,
				} as Parameters<typeof upsertDesktopItem>[1] & {
					parent_item_id: string;
				};
				await upsertDesktopItem(itemId, nestedFolderPayload);
				await fetchFolders();
				requestDesktopItemsRefresh();
				notify.success(t('explorer.folderCreated'), name);
			} catch (error) {
				await fetchFolders();
				notify.error(
					t('explorer.folderMutationFailed'),
					getApiErrorMessage(error),
					{ duration: 6000 }
				);
			}
		},
		[desktopFolderItems, fetchFolders, t]
	);

	const renameExplorerFolder = useCallback(
		async (itemId: string, currentName: string) => {
			const folder = desktopFolderItems.find((item) => item.item_id === itemId);
			if (!folder || folder.is_system) return;
			const name = window
				.prompt(t('explorer.renameFolderPrompt'), currentName)
				?.trim();
			if (!name || name === currentName) return;
			try {
				await updateDesktopItem(itemId, { name });
				await fetchFolders();
				requestDesktopItemsRefresh();
				notify.success(t('explorer.folderRenamed'), name);
			} catch (error) {
				await fetchFolders();
				notify.error(
					t('explorer.folderMutationFailed'),
					getApiErrorMessage(error),
					{ duration: 6000 }
				);
			}
		},
		[desktopFolderItems, fetchFolders, t]
	);

	const deleteExplorerFolder = useCallback(
		async (itemId: string, name: string) => {
			const folder = desktopFolderItems.find((item) => item.item_id === itemId);
			if (
				!folder ||
				folder.is_system ||
				!window.confirm(t('explorer.deleteFolderConfirm', { name }))
			) {
				return;
			}
			try {
				await deleteDesktopItem(itemId);
				if (explorerFolderTarget === itemId) {
					setExplorerFolderTarget('unfiled');
				}
				await fetchFolders();
				requestDesktopItemsRefresh({ removedItemIds: [itemId] });
				notify.success(t('explorer.folderDeleted'), name);
			} catch (error) {
				await fetchFolders();
				notify.error(
					t('explorer.folderMutationFailed'),
					getApiErrorMessage(error),
					{ duration: 6000 }
				);
			}
		},
		[
			desktopFolderItems,
			explorerFolderTarget,
			fetchFolders,
			setExplorerFolderTarget,
			t,
		]
	);

	const moveContentToFolder = useCallback(
		async (contentIds: string[], targetFolderItemId: string | null) => {
			const toMove = contentIds.filter((id) => {
				const item = items.find((candidate) => candidate.id === id);
				if (item?.can_edit === false) return false;
				const currentFolder = item?.folder_item_id ?? null;
				return targetFolderItemId == null
					? currentFolder != null
					: currentFolder !== targetFolderItemId;
			});
			if (toMove.length === 0) return;
			try {
				const results = await Promise.allSettled(
					toMove.map((id) =>
						contentApi.updateContent(
							id,
							buildContentMoveScopePatch(targetFolderItemId, projects)
						)
					)
				);
				const failed = results.filter(
					(result) => result.status === 'rejected'
				).length;
				if (failed === toMove.length) {
					const first = results.find(
						(result) => result.status === 'rejected'
					) as PromiseRejectedResult | undefined;
					throw first?.reason ?? new Error('move failed');
				}
				if (failed > 0) {
					notify.error(
						t('explorer.movePartialTitle'),
						t('explorer.movePartialDesc', {
							ok: toMove.length - failed,
							failed,
						}),
						{ duration: 5000 }
					);
				} else {
					notify.success(
						t('explorer.moveOkTitle'),
						t('explorer.moveOkDesc', { count: toMove.length }),
						{ duration: 3000 }
					);
				}
				await fetchContent();
				await fetchStats();
				void fetchManagerActivity();
				requestDesktopFolderLibraryCountsInvalidate({
					folderIds: collectFolderIdsForLibraryMutation(
						items,
						toMove,
						targetFolderItemId
					),
				});
			} catch (error) {
				const message = getApiErrorMessage(error);
				const hint = getContentRecoveryHint('update', error, t);
				notify.error(t('explorer.moveFailedTitle'), `${message}. ${hint}`, {
					duration: 6000,
				});
			}
		},
		[fetchContent, fetchManagerActivity, fetchStats, items, projects, t]
	);

	const onExplorerDropToFolder = useCallback(
		async (event: React.DragEvent, targetFolderItemId: string | null) => {
			event.preventDefault();
			event.stopPropagation();
			setExplorerDropHighlight(null);
			const ids = parseContentDragIds(event);
			if (ids.length > 0) await moveContentToFolder(ids, targetFolderItemId);
		},
		[moveContentToFolder]
	);

	return {
		folders,
		desktopFolderItems,
		explorerNestedFolders,
		folderTreeRoots,
		explorerExpandedFolderIds,
		setExplorerExpandedFolderIds,
		explorerDropHighlight,
		setExplorerDropHighlight,
		folderMenuTarget,
		folderMenuPos,
		fetchFolders,
		openFolderMenu,
		closeFolderMenu,
		createFolderUnderParent,
		renameExplorerFolder,
		deleteExplorerFolder,
		onExplorerDropToFolder,
	};
}
