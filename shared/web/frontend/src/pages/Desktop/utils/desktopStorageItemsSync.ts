/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Debounced per-item position PUT and full ITEMS PUT sync for desktop storage.
 * Pure async helpers called from `useDesktopStorage` (no React hooks).
 *
 * Invariants:
 * - Pending position sync skips when offline or before first successful hydrate.
 * - Full sync queues while in-flight; caller re-invokes with queued list.
 * - Failed full sync marks subject workspace cache dirty when subject is set.
 *
 * Related:
 * - hooks/useDesktopStorage.ts
 * - utils/desktopWorkspaceLocalCache.ts
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { api } from '../../../services/api/client';
import { log } from '../../../utils/logger';
import { API_ENDPOINTS, DESKTOP_API_BASE } from '../constants';
import { toApiItem } from '../services/desktopApi';
import {
	DESKTOP_STORAGE_SYNC_ERROR,
	type DesktopStorageSyncErrorCode,
} from './desktopStorageSyncError';
import { writeDesktopWorkspaceLocalCache } from './desktopWorkspaceLocalCache';
import type {
	DesktopConfig,
	DesktopItem,
	DesktopItemConfig,
} from '../types/desktop.types';

export async function syncDesktopPendingItemUpdates(params: {
	pendingUpdates: MutableRefObject<Map<string, Partial<DesktopItemConfig>>>;
	itemsRef: MutableRefObject<DesktopItem[]>;
	hasLoadedServerSnapshotRef: MutableRefObject<boolean>;
	isOnline: boolean;
	setIsSyncing: Dispatch<SetStateAction<boolean>>;
	setError: Dispatch<SetStateAction<DesktopStorageSyncErrorCode | null>>;
}): Promise<void> {
	const {
		pendingUpdates,
		itemsRef,
		hasLoadedServerSnapshotRef,
		isOnline,
		setIsSyncing,
		setError,
	} = params;

	if (
		!isOnline ||
		pendingUpdates.current.size === 0 ||
		!hasLoadedServerSnapshotRef.current
	) {
		return;
	}

	setIsSyncing(true);
	setError(null);
	try {
		const updates = Array.from(pendingUpdates.current.entries());
		const currentItems = itemsRef.current;
		const results = await Promise.all(
			updates.map(async ([itemId, update]) => {
				const item = currentItems.find((i) => i.id === itemId);
				if (!item) return { itemId, ok: true };

				const payload = {
					...toApiItem(item),
					position: update.position || item.position,
				};

				try {
					await api.put(API_ENDPOINTS.ITEM(itemId), payload, {
						baseURL: DESKTOP_API_BASE,
					});
					return { itemId, ok: true };
				} catch (e) {
					const status = (e as { response?: { status?: number } })?.response
						?.status;
					log.warn(
						'Desktop',
						`Failed to sync item ${itemId}`,
						status != null ? `HTTP ${status}` : e
					);
					return { itemId, ok: false };
				}
			})
		);

		const succeeded = results.filter((r) => r.ok);
		const failed = results.filter((r) => !r.ok);
		succeeded.forEach((r) => {
			pendingUpdates.current.delete(r.itemId);
		});
		if (failed.length > 0) {
			setError(DESKTOP_STORAGE_SYNC_ERROR.SYNC_FAILED);
			log.warn(
				'Desktop',
				`Sync failed for ${failed.length} items:`,
				failed.map((f) => f.itemId)
			);
		}
	} catch (e) {
		setError(DESKTOP_STORAGE_SYNC_ERROR.SYNC_FAILED);
		log.error(
			'Desktop',
			'Failed to sync to server',
			e instanceof Error ? e : undefined
		);
	} finally {
		setIsSyncing(false);
	}
}

export type DesktopFullItemsSyncResult =
	| { status: 'skipped' }
	| { status: 'queued' }
	| { status: 'ok'; listSent: DesktopItem[] }
	| {
			status: 'error';
			listSent: DesktopItem[];
			error: DesktopStorageSyncErrorCode;
	  };

/**
 * Full ITEMS PUT. When another full sync is in flight, queues `listToSend` on
 * `queuedFullSyncItemsRef` and returns `{ status: 'queued' }`. Caller must
 * re-invoke after the in-flight sync clears when a distinct queue remains.
 */
export async function syncDesktopItemsFullPut(params: {
	listToSend: DesktopItem[];
	isOnline: boolean;
	persistSubjectKey: string | null;
	config: DesktopConfig | null;
	hasLoadedServerSnapshotRef: MutableRefObject<boolean>;
	fullSyncInFlightRef: MutableRefObject<boolean>;
	queuedFullSyncItemsRef: MutableRefObject<DesktopItem[] | null>;
	setIsSyncing: Dispatch<SetStateAction<boolean>>;
	setError: Dispatch<SetStateAction<DesktopStorageSyncErrorCode | null>>;
	broadcastDesktopMutation: (scope: 'config' | 'items') => void;
}): Promise<DesktopFullItemsSyncResult> {
	const {
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
	} = params;

	if (!isOnline || !hasLoadedServerSnapshotRef.current) {
		if (!isOnline && persistSubjectKey) {
			writeDesktopWorkspaceLocalCache({
				subject: persistSubjectKey,
				items: listToSend,
				config,
				itemsDirty: true,
			});
		}
		return { status: 'skipped' };
	}

	if (fullSyncInFlightRef.current) {
		queuedFullSyncItemsRef.current = listToSend;
		return { status: 'queued' };
	}

	fullSyncInFlightRef.current = true;
	setIsSyncing(true);
	setError(null);
	try {
		const itemPayloads = listToSend.map((item) => toApiItem(item));
		await api.put(
			API_ENDPOINTS.ITEMS,
			{ items: itemPayloads },
			{ baseURL: DESKTOP_API_BASE }
		);
		broadcastDesktopMutation('items');
		if (persistSubjectKey) {
			writeDesktopWorkspaceLocalCache({
				subject: persistSubjectKey,
				items: listToSend,
				config,
				itemsDirty: false,
			});
		}
		return { status: 'ok', listSent: listToSend };
	} catch (e) {
		const status =
			(e as { statusCode?: number }).statusCode ??
			(e as { response?: { status?: number } })?.response?.status;
		if (persistSubjectKey) {
			writeDesktopWorkspaceLocalCache({
				subject: persistSubjectKey,
				items: listToSend,
				config,
				itemsDirty: true,
			});
		}
		if (status === 503) {
			log.warn(
				'Desktop',
				'Config saved locally; server temporarily unavailable (503)'
			);
			const error = DESKTOP_STORAGE_SYNC_ERROR.SERVER_UNAVAILABLE_LOCAL;
			setError(error);
			return { status: 'error', listSent: listToSend, error };
		}
		log.error(
			'Desktop',
			'Failed to sync to server',
			e instanceof Error ? e : undefined
		);
		const error = DESKTOP_STORAGE_SYNC_ERROR.SERVER_SYNC_FAILED;
		setError(error);
		return { status: 'error', listSent: listToSend, error };
	} finally {
		fullSyncInFlightRef.current = false;
		setIsSyncing(false);
	}
}
