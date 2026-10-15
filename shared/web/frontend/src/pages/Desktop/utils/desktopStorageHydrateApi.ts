/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Authenticated desktop config/items hydrate from API (shell-bootstrap + dirty
 * flush-before-GET). Called from `useDesktopStorage` — no React hooks here.
 *
 * Invariants:
 * - Abort signal / auth-abort errors must not wipe durable cache.
 * - Dirty subject cache flushes before items hydrate overwrite on reconnect.
 * - When shell-bootstrap includes `items` and no dirty flush ran, skip GET /items.
 *
 * Related:
 * - hooks/useDesktopStorage.ts
 * - utils/desktopWorkspaceLocalCache.ts
 * - documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md
 */

import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import { isHttpRequestAbortLikeError } from '@/services/auth/authSessionHttpAbort';
import { api } from '../../../services/api/client';
import { log } from '../../../utils/logger';
import {
	BootstrappingPhase,
	setBootstrappingPhase,
} from '@/services/boot/bootstrappingState';
import {
	logBootPerformanceSummary,
	markBootPerformance,
} from '@/services/boot/bootPerformance';
import { API_ENDPOINTS, DESKTOP_API_BASE } from '../constants';
import type { DesktopItemResponse } from '../services/desktopApi';
import {
	fromApiItem,
	toApiIconSize,
	toApiItem,
	toApiTheme,
} from '../services/desktopApi';
import {
	classifyDesktopLoadFailure,
	type DesktopLoadFailureInfo,
} from '../utils/desktopUi';
import { normalizeDesktopConfigFromApiResponse } from '../utils/desktopConfigPatch';
import {
	markDesktopWorkspaceItemsDirty,
	peekDesktopWorkspaceLocalCache,
	writeDesktopWorkspaceLocalCache,
} from '../utils/desktopWorkspaceLocalCache';
import {
	dedupeDesktopItemsById,
	mergeDesktopItemsWithDefaults,
} from '../utils/desktopStorageItemMerge';
import type { DesktopConfig, DesktopItem } from '../types/desktop.types';

export const DESKTOP_STORAGE_LOAD_RETRY_MAX = 2;
export const DESKTOP_STORAGE_LOAD_RETRY_DELAY_MS = 900;

export type DesktopStorageHydrateApiContext = {
	persistSubjectKey: string | null;
	itemsRef: MutableRefObject<DesktopItem[]>;
	hasLoadedServerSnapshotRef: MutableRefObject<boolean>;
	loadFromAPIRetryCount: MutableRefObject<number>;
	defaultConfig: DesktopConfig;
	setConfig: Dispatch<SetStateAction<DesktopConfig | null>>;
	setItems: Dispatch<SetStateAction<DesktopItem[]>>;
	setIsLoading: Dispatch<SetStateAction<boolean>>;
	setIsItemsHydrating: Dispatch<SetStateAction<boolean>>;
	setLoadFailure: Dispatch<SetStateAction<DesktopLoadFailureInfo | null>>;
};

export async function loadDesktopStorageFromApi(
	ctx: DesktopStorageHydrateApiContext,
	signal?: AbortSignal
): Promise<void> {
	const {
		persistSubjectKey,
		itemsRef,
		hasLoadedServerSnapshotRef,
		loadFromAPIRetryCount,
		defaultConfig,
		setConfig,
		setItems,
		setIsLoading,
		setIsItemsHydrating,
		setLoadFailure,
	} = ctx;

	let retryScheduled = false;
	const aborted = () => Boolean(signal?.aborted);
	try {
		if (aborted()) return;
		setIsLoading(true);
		setLoadFailure(null);
		setBootstrappingPhase(BootstrappingPhase.SYNCING_WORKSPACE);

		const apiOpts = {
			baseURL: DESKTOP_API_BASE,
			signal,
			headers: {
				'Cache-Control': 'no-cache',
				Pragma: 'no-cache',
			} as Record<string, string>,
		};
		const { ensureDesktopShellBootstrap, peekDesktopShellBootstrap } =
			await import('../services/desktopShellBootstrap');
		await ensureDesktopShellBootstrap({ forceDesktop: true });
		if (aborted()) return;
		const bootConfig = peekDesktopShellBootstrap()?.desktop_config;
		const configResponse =
			bootConfig ??
			(await api.get<import('../services/desktopApi').DesktopConfigResponse>(
				API_ENDPOINTS.CONFIG,
				apiOpts
			));
		if (aborted()) return;
		const normalizedConfig =
			normalizeDesktopConfigFromApiResponse(configResponse);

		loadFromAPIRetryCount.current = 0;
		setConfig(normalizedConfig);
		if (persistSubjectKey) {
			writeDesktopWorkspaceLocalCache({
				subject: persistSubjectKey,
				items: itemsRef.current,
				config: normalizedConfig,
				itemsDirty:
					peekDesktopWorkspaceLocalCache(persistSubjectKey)?.itemsDirty ??
					false,
			});
		}
		setIsLoading(false);
		markBootPerformance('desktop-config-ready');

		setIsItemsHydrating(true);

		const subjectKey = persistSubjectKey?.trim() || null;
		const dirtyCache = subjectKey
			? peekDesktopWorkspaceLocalCache(subjectKey)
			: null;
		let flushedDirtyItems = false;
		if (subjectKey && dirtyCache?.itemsDirty && dirtyCache.items.length > 0) {
			try {
				await api.put(
					API_ENDPOINTS.ITEMS,
					{
						items: dirtyCache.items.map((item) => toApiItem(item)),
					},
					{ ...apiOpts }
				);
				markDesktopWorkspaceItemsDirty(subjectKey, false);
				flushedDirtyItems = true;
			} catch (flushErr) {
				if (!isHttpRequestAbortLikeError(flushErr)) {
					log.warn(
						'Desktop',
						'Dirty items flush before GET failed; keeping local snapshot'
					);
					const mergedLocal = mergeDesktopItemsWithDefaults(
						dedupeDesktopItemsById(dirtyCache.items)
					);
					setItems(mergedLocal);
					hasLoadedServerSnapshotRef.current = true;
					writeDesktopWorkspaceLocalCache({
						subject: subjectKey,
						items: mergedLocal,
						config: normalizedConfig,
						itemsDirty: true,
					});
					setBootstrappingPhase(BootstrappingPhase.READY);
					markBootPerformance('desktop-items-ready');
					logBootPerformanceSummary();
					return;
				}
			}
		}

		const bootItems = peekDesktopShellBootstrap()?.items;
		const itemsResponse =
			!flushedDirtyItems && bootItems != null
				? bootItems
				: await api.get<{ items: DesktopItemResponse[] }>(
						API_ENDPOINTS.ITEMS,
						apiOpts
					);
		if (aborted()) return;
		const rawItems = itemsResponse?.items;
		if (rawItems && rawItems.length > 0) {
			const loadedItems = rawItems.map(
				(row) => ({ ...fromApiItem(row), children: [] }) as DesktopItem
			);
			const deduped = dedupeDesktopItemsById(loadedItems);
			const mergedItems = mergeDesktopItemsWithDefaults(deduped);

			const appItems = mergedItems.filter((i) => i.type === 'app');
			const missingComponent = appItems.filter(
				(i) => !i.appComponent || i.appComponent.trim() === ''
			);
			if (missingComponent.length > 0) {
				console.warn(
					'[Desktop:Debug] Items without appComponent from API',
					JSON.stringify(
						missingComponent.map((i) => ({ id: i.id, name: i.name }))
					)
				);
			}
			setItems(mergedItems);
			hasLoadedServerSnapshotRef.current = true;
			if (persistSubjectKey) {
				writeDesktopWorkspaceLocalCache({
					subject: persistSubjectKey,
					items: mergedItems,
					config: normalizedConfig,
					itemsDirty: false,
				});
			}
		} else {
			const fallbackItems = mergeDesktopItemsWithDefaults([]);
			setItems(fallbackItems);
			hasLoadedServerSnapshotRef.current = true;
			if (persistSubjectKey) {
				writeDesktopWorkspaceLocalCache({
					subject: persistSubjectKey,
					items: fallbackItems,
					config: normalizedConfig,
					itemsDirty: false,
				});
			}
		}
		setBootstrappingPhase(BootstrappingPhase.READY);
		markBootPerformance('desktop-items-ready');
		logBootPerformanceSummary();
	} catch (e: unknown) {
		if (aborted() || isHttpRequestAbortLikeError(e)) {
			return;
		}
		hasLoadedServerSnapshotRef.current = false;
		const err = e as { response?: { status: number }; message?: string };
		const status = err.response?.status;
		if (status === 404) {
			setConfig(defaultConfig);
			try {
				const createPayload = {
					...defaultConfig,
					theme: toApiTheme(defaultConfig.theme),
					icon_size: toApiIconSize(defaultConfig.icon_size),
				};
				await api.post(API_ENDPOINTS.CONFIG, createPayload, {
					baseURL: DESKTOP_API_BASE,
					signal,
				});
			} catch (createErr) {
				if (!isHttpRequestAbortLikeError(createErr)) {
					// ignore non-abort create failures
				}
			}
		} else {
			const classified = classifyDesktopLoadFailure(e);
			if (classified.kind === 'aborted') {
				return;
			}
			log.warn(
				'Desktop',
				`Load from API failed: ${status != null ? `HTTP ${status}` : err.message} (${classified.kind})`
			);
			const retriable =
				status === 401 ||
				classified.kind === 'network' ||
				classified.kind === 'timeout' ||
				classified.kind === 'server';

			if (
				retriable &&
				loadFromAPIRetryCount.current < DESKTOP_STORAGE_LOAD_RETRY_MAX
			) {
				loadFromAPIRetryCount.current += 1;
				retryScheduled = true;
				const delay =
					DESKTOP_STORAGE_LOAD_RETRY_DELAY_MS * loadFromAPIRetryCount.current;
				await new Promise<void>((resolve, reject) => {
					const timer = window.setTimeout(() => resolve(), delay);
					const onAbort = () => {
						window.clearTimeout(timer);
						reject(
							typeof DOMException !== 'undefined'
								? new DOMException('Aborted', 'AbortError')
								: new Error('Aborted')
						);
					};
					if (signal?.aborted) {
						onAbort();
						return;
					}
					signal?.addEventListener('abort', onAbort, { once: true });
				}).catch(() => undefined);
				if (aborted()) return;
				await loadDesktopStorageFromApi(ctx, signal);
				return;
			}
			setLoadFailure({
				kind: status === 401 ? 'auth' : classified.kind,
				httpStatus: classified.httpStatus,
			});
		}
	} finally {
		if (!aborted()) {
			setIsItemsHydrating(false);
			if (!retryScheduled) {
				setIsLoading(false);
			}
		}
	}
}
