/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Online/offline listeners, multi-tab conflict detection, and desktop mutation broadcast.
 *
 * Invariants:
 * - Storage event only fires for other tabs; local tabId must be ignored.
 * - broadcastDesktopMutation writes STORAGE_SYNC_META_KEY for cross-tab awareness.
 *
 * Related:
 * - hooks/desktopStorage/constants.ts
 * - hooks/useDesktopStorage.ts
 */

import { useCallback, useEffect, type MutableRefObject } from 'react';
import { STORAGE_KEYS } from '../../constants';
import { STORAGE_SYNC_META_KEY } from './constants';

export type UseDesktopStoragePresenceParams = {
	tabIdRef: MutableRefObject<string>;
	setIsOnline: (online: boolean) => void;
	setTabConflictDetected: (detected: boolean) => void;
};

export type UseDesktopStoragePresenceReturn = {
	broadcastDesktopMutation: (scope: 'config' | 'items') => void;
	clearTabConflict: () => void;
};

export function useDesktopStoragePresence(
	params: UseDesktopStoragePresenceParams
): UseDesktopStoragePresenceReturn {
	const { tabIdRef, setIsOnline, setTabConflictDetected } = params;

	const broadcastDesktopMutation = useCallback(
		(scope: 'config' | 'items') => {
			try {
				localStorage.setItem(
					STORAGE_SYNC_META_KEY,
					JSON.stringify({
						scope,
						tabId: tabIdRef.current,
						updatedAt: Date.now(),
					})
				);
			} catch {
				// ignore storage failures
			}
		},
		[tabIdRef]
	);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, [setIsOnline]);

	useEffect(() => {
		const handleStorage = (e: StorageEvent) => {
			if (e.key === STORAGE_KEYS.ITEMS) {
				setTabConflictDetected(true);
				return;
			}
			if (e.key === STORAGE_SYNC_META_KEY && e.newValue) {
				try {
					const payload = JSON.parse(e.newValue) as { tabId?: string };
					if (payload.tabId && payload.tabId !== tabIdRef.current) {
						setTabConflictDetected(true);
					}
				} catch {
					setTabConflictDetected(true);
				}
			}
		};
		window.addEventListener('storage', handleStorage);
		return () => window.removeEventListener('storage', handleStorage);
	}, [setTabConflictDetected, tabIdRef]);

	const clearTabConflict = useCallback(
		() => setTabConflictDetected(false),
		[setTabConflictDetected]
	);

	return { broadcastDesktopMutation, clearTabConflict };
}
