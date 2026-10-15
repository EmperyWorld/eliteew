/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop config hydrate from API, initial load effect, and config persist helpers.
 *
 * Invariants:
 * - Authenticated + online → API hydrate; offline/unauth → local cache defaults.
 * - Config PATCH failures queue offline when persistSubjectKey is set.
 *
 * Related:
 * - utils/desktopStorageHydrateApi.ts
 * - utils/desktopConfigPatch.ts
 * - hooks/useDesktopStorage.ts
 */

import {
	useCallback,
	useEffect,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import { log } from '../../../../utils/logger';
import type { DesktopConfigUpdate } from '../../services/desktopApi';
import { updateDesktopConfig } from '../../services/desktopApi';
import type { DesktopConfig, DesktopItem } from '../../types/desktop.types';
import {
	buildDesktopConfigApiPatchPayload,
	mergeDesktopConfigWithApiResponse,
} from '../../utils/desktopConfigPatch';
import { enqueueDesktopPersistConfigPatch } from '../../utils/desktopPersistPatchQueue';
import { loadDesktopStorageFromApi } from '../../utils/desktopStorageHydrateApi';
import {
	DESKTOP_STORAGE_CONFIG_SAVE_ERROR,
	type DesktopStorageConfigSaveErrorCode,
} from '../../utils/desktopStorageSyncError';
import type { DesktopLoadFailureInfo } from '../../utils/desktopUi';
import type { DesktopConfigPersistOptions } from '../useDesktopStorage.types';
import { DEFAULT_CONFIG, LOAD_STALL_MS } from './constants';

export type UseDesktopStorageConfigHydrationParams = {
	persistSubjectKey: string | null;
	hasAuthenticatedSession: boolean;
	isAuthenticated: boolean;
	authLoading: boolean;
	isOnline: boolean;
	isLoading: boolean;
	config: DesktopConfig | null;
	itemsRef: MutableRefObject<DesktopItem[]>;
	hasLoadedServerSnapshotRef: MutableRefObject<boolean>;
	loadFromAPIRetryCount: MutableRefObject<number>;
	setConfig: Dispatch<SetStateAction<DesktopConfig | null>>;
	setItems: Dispatch<SetStateAction<DesktopItem[]>>;
	setIsLoading: Dispatch<SetStateAction<boolean>>;
	setIsItemsHydrating: Dispatch<SetStateAction<boolean>>;
	setLoadFailure: Dispatch<SetStateAction<DesktopLoadFailureInfo | null>>;
	setIsLoadingStalled: Dispatch<SetStateAction<boolean>>;
	setIsConfigSaving: Dispatch<SetStateAction<boolean>>;
	setConfigSaveError: Dispatch<
		SetStateAction<DesktopStorageConfigSaveErrorCode | null>
	>;
	loadFromLocalStorage: () => void;
	broadcastDesktopMutation: (scope: 'config' | 'items') => void;
};

export type UseDesktopStorageConfigHydrationReturn = {
	loadFromAPI: (signal?: AbortSignal) => Promise<void>;
	updateConfig: (
		updates: Partial<DesktopConfig>,
		options?: DesktopConfigPersistOptions
	) => Promise<void>;
	applyPersistedConfigPatch: (
		payload: Record<string, unknown>
	) => Promise<void>;
	applyDesktopConfigSnapshotLocal: (snapshot: DesktopConfig) => void;
	refresh: () => Promise<void>;
	clearLoadFailure: () => void;
};

export function useDesktopStorageConfigHydration(
	params: UseDesktopStorageConfigHydrationParams
): UseDesktopStorageConfigHydrationReturn {
	const {
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
	} = params;

	const clearLoadFailure = useCallback(
		() => setLoadFailure(null),
		[setLoadFailure]
	);

	useEffect(() => {
		if (!isLoading) {
			setIsLoadingStalled(false);
			return;
		}
		const timer = window.setTimeout(
			() => setIsLoadingStalled(true),
			LOAD_STALL_MS
		);
		return () => window.clearTimeout(timer);
	}, [isLoading, setIsLoadingStalled]);

	const loadFromAPI = useCallback(
		async (signal?: AbortSignal) => {
			await loadDesktopStorageFromApi(
				{
					persistSubjectKey,
					itemsRef,
					hasLoadedServerSnapshotRef,
					loadFromAPIRetryCount,
					defaultConfig: DEFAULT_CONFIG,
					setConfig,
					setItems,
					setIsLoading,
					setIsItemsHydrating,
					setLoadFailure,
				},
				signal
			);
		},
		[
			hasLoadedServerSnapshotRef,
			itemsRef,
			loadFromAPIRetryCount,
			persistSubjectKey,
			setConfig,
			setIsItemsHydrating,
			setIsLoading,
			setItems,
			setLoadFailure,
		]
	);

	useEffect(() => {
		const ac = new AbortController();
		if (!isOnline) {
			loadFromLocalStorage();
			setIsLoading(false);
			return () => ac.abort();
		}
		if (hasAuthenticatedSession) {
			void loadFromAPI(ac.signal);
			return () => ac.abort();
		}
		if (authLoading) {
			setIsLoading(true);
			return () => ac.abort();
		}
		if (!isAuthenticated) {
			loadFromLocalStorage();
			setIsLoading(false);
			return () => ac.abort();
		}
		return () => ac.abort();
	}, [
		authLoading,
		hasAuthenticatedSession,
		isAuthenticated,
		isOnline,
		loadFromAPI,
		loadFromLocalStorage,
		setIsLoading,
	]);

	const applyPersistedConfigPatch = useCallback(
		async (payload: Record<string, unknown>) => {
			const response = await updateDesktopConfig(
				payload as DesktopConfigUpdate
			);
			setConfig((prev) =>
				mergeDesktopConfigWithApiResponse(prev ?? DEFAULT_CONFIG, response)
			);
			broadcastDesktopMutation('config');
			setConfigSaveError(null);
		},
		[broadcastDesktopMutation, setConfig, setConfigSaveError]
	);

	const updateConfig = useCallback(
		async (
			updates: Partial<DesktopConfig>,
			options?: DesktopConfigPersistOptions
		) => {
			const persistRemote = options?.persistRemote !== false;
			const base = config ?? DEFAULT_CONFIG;
			const newConfig = { ...base, ...updates } as DesktopConfig;
			setConfig(newConfig);

			if (!persistRemote) {
				return;
			}

			const patchPayload = buildDesktopConfigApiPatchPayload(updates);
			if (!patchPayload || Object.keys(patchPayload).length === 0) {
				return;
			}

			if (!isOnline) {
				if (persistSubjectKey) {
					enqueueDesktopPersistConfigPatch(persistSubjectKey, patchPayload);
				}
				return;
			}

			try {
				setIsConfigSaving(true);
				setConfigSaveError(null);
				const response = await updateDesktopConfig(
					patchPayload as DesktopConfigUpdate
				);
				setConfig(mergeDesktopConfigWithApiResponse(newConfig, response));
				broadcastDesktopMutation('config');
			} catch (e) {
				if (persistSubjectKey) {
					enqueueDesktopPersistConfigPatch(persistSubjectKey, patchPayload);
				}
				const status =
					(e as { response?: { status?: number }; statusCode?: number })
						?.response?.status ?? (e as { statusCode?: number })?.statusCode;
				if (status === 503) {
					log.warn(
						'Desktop',
						'Config PATCH failed: server temporarily unavailable (503)'
					);
					setConfigSaveError(
						DESKTOP_STORAGE_CONFIG_SAVE_ERROR.QUEUED_SERVER_UNAVAILABLE
					);
				} else {
					log.warn('Desktop', 'Failed to save config to server', e);
					setConfigSaveError(
						DESKTOP_STORAGE_CONFIG_SAVE_ERROR.FAILED_LOCAL_KEPT
					);
				}
			} finally {
				setIsConfigSaving(false);
			}
		},
		[
			broadcastDesktopMutation,
			config,
			isOnline,
			persistSubjectKey,
			setConfig,
			setConfigSaveError,
			setIsConfigSaving,
		]
	);

	const applyDesktopConfigSnapshotLocal = useCallback(
		(snapshot: DesktopConfig) => {
			setConfig(snapshot);
			setConfigSaveError(null);
		},
		[setConfig, setConfigSaveError]
	);

	const refresh = useCallback(async () => {
		setLoadFailure(null);
		if (isOnline) {
			await loadFromAPI();
		} else {
			loadFromLocalStorage();
		}
	}, [isOnline, loadFromAPI, loadFromLocalStorage, setLoadFailure]);

	return {
		loadFromAPI,
		updateConfig,
		applyPersistedConfigPatch,
		applyDesktopConfigSnapshotLocal,
		refresh,
		clearLoadFailure,
	};
}
