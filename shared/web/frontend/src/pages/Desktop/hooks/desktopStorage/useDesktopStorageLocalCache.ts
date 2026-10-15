/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Subject-scoped workspace local cache load/save for desktop config and items.
 *
 * Invariants:
 * - Offline/unauthenticated restore never wipes another subject's durable snapshot.
 * - saveToLocalStorage no-ops without persistSubjectKey.
 *
 * Related:
 * - utils/desktopWorkspaceLocalCache.ts
 * - hooks/useDesktopStorage.ts
 */

import {
	useCallback,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import { log } from '../../../../utils/logger';
import type { DesktopConfig, DesktopItem } from '../../types/desktop.types';
import { mergeDesktopItemsWithDefaults } from '../../utils/desktopStorageItemMerge';
import {
	peekDesktopWorkspaceLocalCache,
	writeDesktopWorkspaceLocalCache,
} from '../../utils/desktopWorkspaceLocalCache';
import { DEFAULT_CONFIG } from './constants';

export type UseDesktopStorageLocalCacheParams = {
	persistSubjectKey: string | null;
	config: DesktopConfig | null;
	itemsRef: MutableRefObject<DesktopItem[]>;
	hasLoadedServerSnapshotRef: MutableRefObject<boolean>;
	setConfig: Dispatch<SetStateAction<DesktopConfig | null>>;
	setItems: Dispatch<SetStateAction<DesktopItem[]>>;
};

export type UseDesktopStorageLocalCacheReturn = {
	loadFromLocalStorage: () => void;
	saveToLocalStorage: (
		newConfig?: DesktopConfig,
		newItems?: DesktopItem[]
	) => void;
};

export function useDesktopStorageLocalCache(
	params: UseDesktopStorageLocalCacheParams
): UseDesktopStorageLocalCacheReturn {
	const {
		persistSubjectKey,
		config,
		itemsRef,
		hasLoadedServerSnapshotRef,
		setConfig,
		setItems,
	} = params;

	const loadFromLocalStorage = useCallback(() => {
		try {
			hasLoadedServerSnapshotRef.current = false;
			const subject = persistSubjectKey?.trim() || null;
			if (subject) {
				const cached = peekDesktopWorkspaceLocalCache(subject);
				if (cached) {
					if (cached.config) {
						setConfig({ ...cached.config, show_widget: false });
					} else {
						setConfig({ ...DEFAULT_CONFIG, show_widget: false });
					}
					setItems(mergeDesktopItemsWithDefaults(cached.items ?? []));
					return;
				}
			}
			setConfig({ ...DEFAULT_CONFIG, show_widget: false });
			setItems(mergeDesktopItemsWithDefaults([]));
		} catch (e) {
			log.error(
				'Desktop',
				'Failed to load from local workspace cache',
				e instanceof Error ? e : undefined
			);
		}
	}, [hasLoadedServerSnapshotRef, persistSubjectKey, setConfig, setItems]);

	const saveToLocalStorage = useCallback(
		(newConfig?: DesktopConfig, newItems?: DesktopItem[]) => {
			const subject = persistSubjectKey?.trim();
			if (!subject) return;
			const itemsToSave = newItems ?? itemsRef.current;
			const configToSave = newConfig ?? config;
			const offline =
				typeof navigator !== 'undefined' && navigator.onLine === false;
			const prevDirty =
				peekDesktopWorkspaceLocalCache(subject)?.itemsDirty ?? false;
			const ok = writeDesktopWorkspaceLocalCache({
				subject,
				items: itemsToSave,
				config: configToSave ?? null,
				itemsDirty: offline || prevDirty || Boolean(newItems),
			});
			if (!ok) {
				log.warn(
					'Desktop',
					'Workspace local cache write failed; offline durability not guaranteed'
				);
			}
		},
		[config, itemsRef, persistSubjectKey]
	);

	return { loadFromLocalStorage, saveToLocalStorage };
}
