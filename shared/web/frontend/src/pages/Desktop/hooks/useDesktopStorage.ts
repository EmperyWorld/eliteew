/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin facade for desktop config/items persistence: owns shared state/refs and composes
 * `hooks/desktopStorage/*` subhooks (Wave B atomization).
 *
 * Invariants:
 * - While online + authenticated, API/PostgreSQL is source of truth after successful hydrate.
 * - P3: subject-scoped durable workspace cache preserves offline items/config across reload.
 * - Shared refs (itemsRef, pendingUpdates, sync queues) live only in this facade — never duplicated.
 * - Shell state (windows, virtual desktops, MRU) remains in separate shell-state hooks.
 *
 * Related:
 * - hooks/useDesktopStorage.types.ts
 * - hooks/desktopStorage/constants.ts
 * - hooks/desktopStorage/useDesktopStoragePresence.ts
 * - hooks/desktopStorage/useDesktopStorageLocalCache.ts
 * - hooks/desktopStorage/useDesktopStorageConfigHydration.ts
 * - hooks/desktopStorage/useDesktopStorageItemsSync.ts
 * - utils/desktopStorageHydrateApi.ts, desktopStorageItemsSync.ts,
 *   desktopStorageItemMerge.ts, desktopStorageItemMutations.ts
 * - utils/desktopWorkspaceLocalCache.ts, desktopConfigPatch.ts
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md §4.1
 * - `services/unifiedContentEvents.ts` (DESKTOP_ITEMS_REFRESH_EVENT)
 */

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import authSession from '../../../services/authSession';
import type { DesktopLoadFailureInfo } from '../utils/desktopUi';
import type {
	DesktopStorageConfigSaveErrorCode,
	DesktopStorageSyncErrorCode,
} from '../utils/desktopStorageSyncError';
import type {
	DesktopConfig,
	DesktopItem,
	DesktopItemConfig,
} from '../types/desktop.types';
import type { UseDesktopStorageReturn } from './useDesktopStorage.types';
import { useDesktopStorageConfigHydration } from './desktopStorage/useDesktopStorageConfigHydration';
import { useDesktopStorageItemsSync } from './desktopStorage/useDesktopStorageItemsSync';
import { useDesktopStorageLocalCache } from './desktopStorage/useDesktopStorageLocalCache';
import { useDesktopStoragePresence } from './desktopStorage/useDesktopStoragePresence';

export type {
	DesktopConfigPersistOptions,
	UseDesktopStorageReturn,
} from './useDesktopStorage.types';

export function useDesktopStorage(): UseDesktopStorageReturn {
	const { t } = useTranslation('desktopUi');
	const { isAuthenticated, loading: authLoading, user: authUser } = useAuth();
	const persistSubjectKey = authUser?.id ?? null;
	const hasAuthenticatedSession = isAuthenticated || Boolean(authSession.token);
	const [config, setConfig] = useState<DesktopConfig | null>(null);
	const [items, setItems] = useState<DesktopItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isItemsHydrating, setIsItemsHydrating] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);
	const [error, setError] = useState<DesktopStorageSyncErrorCode | null>(null);
	const [isOnline, setIsOnline] = useState(navigator.onLine);
	const [tabConflictDetected, setTabConflictDetected] = useState(false);
	const [isConfigSaving, setIsConfigSaving] = useState(false);
	const [configSaveError, setConfigSaveError] =
		useState<DesktopStorageConfigSaveErrorCode | null>(null);
	const [loadFailure, setLoadFailure] = useState<DesktopLoadFailureInfo | null>(
		null
	);
	const [isLoadingStalled, setIsLoadingStalled] = useState(false);

	const pendingUpdates = useRef<Map<string, Partial<DesktopItemConfig>>>(
		new Map()
	);
	const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const itemsRef = useRef<DesktopItem[]>(items);
	itemsRef.current = items;
	const tabIdRef = useRef(
		`desktop-tab-${Math.random().toString(36).slice(2, 10)}`
	);
	const fullSyncInFlightRef = useRef(false);
	const queuedFullSyncItemsRef = useRef<DesktopItem[] | null>(null);
	const loadFromAPIRetryCount = useRef(0);
	const hasLoadedServerSnapshotRef = useRef(false);

	const { broadcastDesktopMutation, clearTabConflict } =
		useDesktopStoragePresence({
			tabIdRef,
			setIsOnline,
			setTabConflictDetected,
		});

	const { loadFromLocalStorage, saveToLocalStorage } =
		useDesktopStorageLocalCache({
			persistSubjectKey,
			config,
			itemsRef,
			hasLoadedServerSnapshotRef,
			setConfig,
			setItems,
		});

	const {
		updateConfig,
		applyPersistedConfigPatch,
		applyDesktopConfigSnapshotLocal,
		refresh,
		clearLoadFailure,
	} = useDesktopStorageConfigHydration({
		persistSubjectKey,
		hasAuthenticatedSession,
		isAuthenticated,
		authLoading,
		isOnline,
		isLoading,
		config,
		itemsRef,
		hasLoadedServerSnapshotRef,
		loadFromAPIRetryCount,
		setConfig,
		setItems,
		setIsLoading,
		setIsItemsHydrating,
		setLoadFailure,
		setIsLoadingStalled,
		setIsConfigSaving,
		setConfigSaveError,
		loadFromLocalStorage,
		broadcastDesktopMutation,
	});

	const {
		updateItemPosition,
		createFolder,
		updateFolderIcon,
		createMarkdownFile,
		deleteItem,
		togglePinItem,
		replaceItems,
		syncToServer,
	} = useDesktopStorageItemsSync({
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
	});

	return {
		config,
		updateConfig,
		applyDesktopConfigSnapshotLocal,
		isConfigSaving,
		configSaveError,
		applyPersistedConfigPatch,
		items,
		updateItemPosition,
		createFolder,
		updateFolderIcon,
		createMarkdownFile,
		deleteItem,
		togglePinItem,
		replaceItems,
		isLoading,
		isItemsHydrating,
		isSyncing,
		error,
		isOnline,
		tabConflictDetected,
		clearTabConflict,
		refresh,
		syncToServer,
		loadFailure,
		isLoadingStalled,
		clearLoadFailure,
	};
}

export {
	isWallpaperTooLargeForApi,
	MAX_WALLPAPER_LENGTH,
} from '../utils/desktopConfigPatch';
