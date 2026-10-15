/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop items sync: debounced pending PUTs, unload flush, CRUD, replace, full sync.
 *
 * Invariants:
 * - Shared pendingUpdates / itemsRef / sync queue refs come from the facade (never duplicated).
 * - Unload flush uses keepalive fetch (intentional raw /api exception for beforeunload).
 *
 * Related:
 * - utils/desktopStorageItemsSync.ts
 * - utils/desktopStorageItemMutations.ts
 * - hooks/useDesktopStorage.ts
 */

import { notify } from '@/notifications';
import {
	DESKTOP_ITEMS_REFRESH_EVENT,
	type DesktopItemsRefreshDetail,
} from '@/services/unifiedContentEvents';
import {
	useCallback,
	useEffect,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import type { TFunction } from 'i18next';
import { api } from '../../../../services/api/client';
import { resolveAbsoluteApiBaseURL } from '../../../../services/api/config';
import authSession from '../../../../services/authSession';
import { log } from '../../../../utils/logger';
import { API_ENDPOINTS, DESKTOP_API_BASE } from '../../constants';
import type { UserFolderIconId } from '../../constants/folderIcons';
import { resolveUserFolderIconNode } from '../../constants/folderIcons';
import { toApiItem, updateDesktopItem } from '../../services/desktopApi';
import type {
	DesktopConfig,
	DesktopItem,
	DesktopItemConfig,
} from '../../types/desktop.types';
import {
	collectDesktopFileParentScopeChanges,
	syncDesktopFileContentFolderScopes,
} from '../../utils/desktopFileContentFolderScope';
import { withFolderIconOnItem } from '../../utils/desktopFolderIconMeta';
import {
	buildDesktopCreateFolderItem,
	createDesktopMarkdownStorageItem,
	resolveDesktopDeleteConflictMessage,
} from '../../utils/desktopStorageItemMutations';
import {
	syncDesktopItemsFullPut,
	syncDesktopPendingItemUpdates,
} from '../../utils/desktopStorageItemsSync';
import type { DesktopStorageSyncErrorCode } from '../../utils/desktopStorageSyncError';
import { SYNC_DEBOUNCE_MS } from './constants';

export type UseDesktopStorageItemsSyncParams = {
	items: DesktopItem[];
	config: DesktopConfig | null;
	isOnline: boolean;
	persistSubjectKey: string | null;
	t: TFunction;
	pendingUpdates: MutableRefObject<Map<string, Partial<DesktopItemConfig>>>;
	syncTimeoutRef: MutableRefObject<NodeJS.Timeout | null>;
	itemsRef: MutableRefObject<DesktopItem[]>;
	hasLoadedServerSnapshotRef: MutableRefObject<boolean>;
	fullSyncInFlightRef: MutableRefObject<boolean>;
	queuedFullSyncItemsRef: MutableRefObject<DesktopItem[] | null>;
	setItems: Dispatch<SetStateAction<DesktopItem[]>>;
	setIsSyncing: Dispatch<SetStateAction<boolean>>;
	setError: Dispatch<SetStateAction<DesktopStorageSyncErrorCode | null>>;
	saveToLocalStorage: (
		newConfig?: DesktopConfig,
		newItems?: DesktopItem[]
	) => void;
	broadcastDesktopMutation: (scope: 'config' | 'items') => void;
	refresh: () => Promise<void>;
};

export type UseDesktopStorageItemsSyncReturn = {
	updateItemPosition: (
		itemId: string,
		position: { x: number; y: number }
	) => Promise<void>;
	createFolder: (
		name: string,
		options?: { parentId?: string; folderIconId?: UserFolderIconId }
	) => Promise<DesktopItem>;
	updateFolderIcon: (
		itemId: string,
		folderIconId: UserFolderIconId
	) => Promise<void>;
	createMarkdownFile: (options?: {
		parentId?: string;
	}) => Promise<{ contentId: string; item: DesktopItem } | null>;
	deleteItem: (itemId: string) => Promise<void>;
	togglePinItem: (itemId: string) => Promise<void>;
	replaceItems: (next: DesktopItem[]) => void;
	syncToServer: (overrideItems?: DesktopItem[]) => Promise<void>;
};

export function useDesktopStorageItemsSync(
	params: UseDesktopStorageItemsSyncParams
): UseDesktopStorageItemsSyncReturn {
	const {
		items,
		config,
		isOnline,
		persistSubjectKey,
		t,
		pendingUpdates,
		syncTimeoutRef,
		itemsRef,
		hasLoadedServerSnapshotRef,
		fullSyncInFlightRef,
		queuedFullSyncItemsRef,
		setItems,
		setIsSyncing,
		setError,
		saveToLocalStorage,
		broadcastDesktopMutation,
		refresh,
	} = params;

	useEffect(() => {
		const flushPendingSync = () => {
			if (pendingUpdates.current.size === 0) return;
			if (!hasLoadedServerSnapshotRef.current) return;
			const token = authSession.token;
			if (!token) return;
			const base = resolveAbsoluteApiBaseURL(DESKTOP_API_BASE);
			const currentItems = itemsRef.current;
			pendingUpdates.current.forEach((update, itemId) => {
				const item = currentItems.find((i) => i.id === itemId);
				if (!item) return;
				const payload = {
					...toApiItem(item),
					position: update.position || item.position,
				};
				const url = `${base}${API_ENDPOINTS.ITEM(itemId)}`;
				fetch(url, {
					method: 'PUT',
					body: JSON.stringify(payload),
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					keepalive: true,
				}).catch(() => {});
			});
		};
		const onUnload = () => flushPendingSync();
		window.addEventListener('beforeunload', onUnload);
		window.addEventListener('pagehide', onUnload);
		return () => {
			window.removeEventListener('beforeunload', onUnload);
			window.removeEventListener('pagehide', onUnload);
		};
	}, [hasLoadedServerSnapshotRef, itemsRef, pendingUpdates]);

	const scheduleSyncToServer = useCallback(() => {
		if (syncTimeoutRef.current) {
			clearTimeout(syncTimeoutRef.current);
		}

		syncTimeoutRef.current = setTimeout(() => {
			void syncDesktopPendingItemUpdates({
				pendingUpdates,
				itemsRef,
				hasLoadedServerSnapshotRef,
				isOnline,
				setIsSyncing,
				setError,
			});
		}, SYNC_DEBOUNCE_MS);
	}, [
		hasLoadedServerSnapshotRef,
		isOnline,
		itemsRef,
		pendingUpdates,
		setError,
		setIsSyncing,
		syncTimeoutRef,
	]);

	const updateItemPosition = useCallback(
		async (itemId: string, position: { x: number; y: number }) => {
			const existing = itemsRef.current.find((i) => i.id === itemId);
			if (
				existing &&
				existing.position.x === position.x &&
				existing.position.y === position.y
			) {
				return;
			}

			setItems((prev) => {
				const updated = prev.map((item) =>
					item.id === itemId ? { ...item, position } : item
				);
				saveToLocalStorage(undefined, updated);
				return updated;
			});

			pendingUpdates.current.set(itemId, { position });
			broadcastDesktopMutation('items');
			scheduleSyncToServer();
		},
		[
			broadcastDesktopMutation,
			itemsRef,
			pendingUpdates,
			saveToLocalStorage,
			scheduleSyncToServer,
			setItems,
		]
	);

	const createFolder = useCallback(
		async (
			name: string,
			options?: { parentId?: string; folderIconId?: UserFolderIconId }
		): Promise<DesktopItem> => {
			const newFolder = buildDesktopCreateFolderItem({
				name,
				items,
				parentId: options?.parentId,
				folderIconId: options?.folderIconId,
			});

			setItems((prev) => {
				const updated = [...prev, newFolder];
				saveToLocalStorage(undefined, updated);
				return updated;
			});

			if (isOnline) {
				try {
					await api.post(API_ENDPOINTS.ITEMS, toApiItem(newFolder), {
						baseURL: DESKTOP_API_BASE,
					});
				} catch (e) {
					log.warn('Desktop', 'Failed to create folder on server', e);
				}
			}

			return newFolder;
		},
		[isOnline, items, saveToLocalStorage, setItems]
	);

	const updateFolderIcon = useCallback(
		async (itemId: string, folderIconId: UserFolderIconId) => {
			const iconNode = resolveUserFolderIconNode(folderIconId);
			setItems((prev) => {
				const updated = prev.map((row) =>
					row.id === itemId
						? {
								...withFolderIconOnItem(row, folderIconId),
								icon: iconNode,
							}
						: row
				);
				saveToLocalStorage(undefined, updated);
				return updated;
			});

			if (isOnline) {
				try {
					await updateDesktopItem(itemId, {
						meta: { folder_icon: folderIconId },
					});
					broadcastDesktopMutation('items');
				} catch (e) {
					log.warn('Desktop', 'Failed to update folder icon on server', e);
				}
			}
		},
		[broadcastDesktopMutation, isOnline, saveToLocalStorage, setItems]
	);

	const createMarkdownFile = useCallback(
		async (options?: {
			parentId?: string;
		}): Promise<{
			contentId: string;
			item: DesktopItem;
		} | null> => {
			return createDesktopMarkdownStorageItem({
				items,
				config,
				parentId: options?.parentId,
				isOnline,
				t,
				saveToLocalStorage,
				setItems,
				broadcastDesktopMutation,
			});
		},
		[
			broadcastDesktopMutation,
			config,
			isOnline,
			items,
			saveToLocalStorage,
			setItems,
			t,
		]
	);

	const deleteItem = useCallback(
		async (itemId: string) => {
			const item = items.find((i) => i.id === itemId);
			if (item?.isSystem) return;

			if (isOnline) {
				try {
					await api.delete(API_ENDPOINTS.ITEM(itemId), {
						baseURL: DESKTOP_API_BASE,
					});
				} catch (e: unknown) {
					const ax = e as {
						response?: { status?: number; data?: { detail?: unknown } };
					};
					if (ax.response?.status === 409) {
						const msg = resolveDesktopDeleteConflictMessage(
							ax.response.data?.detail,
							t('storage.deleteProjectFolderConflict')
						);
						notify.error(msg);
						return;
					}
					log.warn('Desktop', 'Failed to delete item on server', e);
					notify.error(t('storage.deleteItemFailed'));
					return;
				}
			}

			setItems((prev) => {
				const updated = prev.filter((row) => row.id !== itemId);
				saveToLocalStorage(undefined, updated);
				return updated;
			});
		},
		[items, isOnline, saveToLocalStorage, setItems, t]
	);

	const togglePinItem = useCallback(
		async (itemId: string) => {
			setItems((prev) => {
				const updated = prev.map((item) =>
					item.id === itemId ? { ...item, isPinned: !item.isPinned } : item
				);
				saveToLocalStorage(undefined, updated);
				return updated;
			});

			const item = items.find((i) => i.id === itemId);
			if (isOnline && item) {
				try {
					await api.patch(
						API_ENDPOINTS.ITEM(itemId),
						{ is_pinned: !item.isPinned },
						{ baseURL: DESKTOP_API_BASE }
					);
				} catch (e) {
					log.warn('Desktop', 'Failed to toggle pin on server', e);
				}
			}
		},
		[items, isOnline, saveToLocalStorage, setItems]
	);

	useEffect(() => {
		const onItemsRefresh = (event: Event): void => {
			const detail = (event as CustomEvent<DesktopItemsRefreshDetail>).detail;
			const removed = (detail?.removedItemIds ?? [])
				.map((id) => String(id || '').trim())
				.filter(Boolean);
			if (removed.length > 0) {
				const removedSet = new Set(removed);
				for (const id of removedSet) {
					pendingUpdates.current.delete(id);
				}
				if (queuedFullSyncItemsRef.current) {
					queuedFullSyncItemsRef.current =
						queuedFullSyncItemsRef.current.filter(
							(row) => !removedSet.has(row.id)
						);
				}
				setItems((prev) => {
					const updated = prev.filter((row) => !removedSet.has(row.id));
					if (updated.length === prev.length) return prev;
					saveToLocalStorage(undefined, updated);
					return updated;
				});
			}
			void refresh();
		};
		window.addEventListener(DESKTOP_ITEMS_REFRESH_EVENT, onItemsRefresh);
		return () => {
			window.removeEventListener(DESKTOP_ITEMS_REFRESH_EVENT, onItemsRefresh);
		};
	}, [
		pendingUpdates,
		queuedFullSyncItemsRef,
		refresh,
		saveToLocalStorage,
		setItems,
	]);

	const syncToServer = useCallback(
		async (overrideItems?: DesktopItem[]) => {
			const listToSend = overrideItems ?? items;
			const result = await syncDesktopItemsFullPut({
				listToSend,
				isOnline,
				persistSubjectKey,
				config,
				hasLoadedServerSnapshotRef,
				fullSyncInFlightRef,
				queuedFullSyncItemsRef,
				setIsSyncing,
				setError,
				broadcastDesktopMutation,
			});
			if (result.status === 'ok' || result.status === 'error') {
				const queuedItems = queuedFullSyncItemsRef.current;
				queuedFullSyncItemsRef.current = null;
				if (queuedItems && queuedItems !== result.listSent) {
					void syncToServer(queuedItems);
				}
			}
		},
		[
			broadcastDesktopMutation,
			config,
			fullSyncInFlightRef,
			hasLoadedServerSnapshotRef,
			items,
			isOnline,
			persistSubjectKey,
			queuedFullSyncItemsRef,
			setError,
			setIsSyncing,
		]
	);

	const replaceItems = useCallback(
		(next: DesktopItem[]) => {
			const prev = itemsRef.current;
			const scopeChanges = collectDesktopFileParentScopeChanges(prev, next);

			setItems(next);
			saveToLocalStorage(undefined, next);
			broadcastDesktopMutation('items');
			syncToServer(next);

			if (isOnline && scopeChanges.length > 0) {
				void syncDesktopFileContentFolderScopes(scopeChanges).then(
					({ ok, fail }) => {
						if (fail > 0) {
							log.warn(
								'Desktop',
								`Content folder/project scope sync failed for ${fail}/${scopeChanges.length} files (ok=${ok})`
							);
						}
					}
				);
			}
		},
		[
			broadcastDesktopMutation,
			isOnline,
			itemsRef,
			saveToLocalStorage,
			setItems,
			syncToServer,
		]
	);

	return {
		updateItemPosition,
		createFolder,
		updateFolderIcon,
		createMarkdownFile,
		deleteItem,
		togglePinItem,
		replaceItems,
		syncToServer,
	};
}
