/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query cache for EWDesk linked media blobs (image/video/audio).
 *
 * Invariants:
 * - Blob object URLs stay valid while the query cache entry exists (list and detail share one URL).
 * - Revoke only when that cache entry is removed (GC / removeQueries / logout clear) — not on unmount or refetch.
 *
 * Related:
 * - EwDeskNewsMedia.tsx, ewDeskNewsQueryOptions.ts, documentation/product/desktop/EWDESK-NEWS.md
 */

import {
	useQuery,
	useQueryClient,
	type QueryCache,
	type QueryCacheNotifyEvent,
	type QueryClient,
} from '@tanstack/react-query';
import { api } from '@/services/api/client';
import {
	EWDESK_NEWS_BLOB_SCOPE_ROOT,
	ewDeskNewsBlobQueryOptions,
} from './ewDeskNewsQueryOptions';

const blobUrlRevokeRegistry = new Map<string, () => void>();
const blobUrlsByCacheKey = new Map<string, Set<string>>();
const subscribedCaches = new WeakSet<QueryCache>();

function registerBlobRevoke(cacheKey: string, url: string): string {
	let urls = blobUrlsByCacheKey.get(cacheKey);
	if (!urls) {
		urls = new Set();
		blobUrlsByCacheKey.set(cacheKey, urls);
	}
	urls.add(url);
	blobUrlRevokeRegistry.set(cacheKey, () => {
		for (const liveUrl of urls) {
			URL.revokeObjectURL(liveUrl);
		}
		urls.clear();
	});
	return url;
}

function revokeEwDeskNewsBlobForCacheKey(cacheKey: string): void {
	const revoke = blobUrlRevokeRegistry.get(cacheKey);
	if (!revoke) {
		return;
	}
	revoke();
	blobUrlRevokeRegistry.delete(cacheKey);
	blobUrlsByCacheKey.delete(cacheKey);
}

export function handleEwDeskNewsBlobQueryCacheEvent(
	event: QueryCacheNotifyEvent
): void {
	if (event.type !== 'removed') {
		return;
	}
	const key = event.query.queryKey;
	if (
		!Array.isArray(key) ||
		key[0] !== EWDESK_NEWS_BLOB_SCOPE_ROOT[0] ||
		key[1] !== EWDESK_NEWS_BLOB_SCOPE_ROOT[1]
	) {
		return;
	}
	const cacheKey = typeof key[2] === 'string' ? key[2] : '';
	if (!cacheKey) {
		return;
	}
	revokeEwDeskNewsBlobForCacheKey(cacheKey);
}

export function ensureEwDeskNewsBlobCacheRevoke(
	queryClient: QueryClient
): void {
	const cache = queryClient.getQueryCache();
	if (subscribedCaches.has(cache)) {
		return;
	}
	subscribedCaches.add(cache);
	cache.subscribe(handleEwDeskNewsBlobQueryCacheEvent);
}

/** Test-only: drop revoke fns without calling them (URL stubs may already be gone). */
export function resetEwDeskNewsBlobRevokeRegistryForTests(): void {
	blobUrlRevokeRegistry.clear();
	blobUrlsByCacheKey.clear();
}

export function useEwDeskNewsBlob(
	path: string | null | undefined,
	enabled = true
): { blobUrl: string | null; isLoading: boolean; failed: boolean } {
	const queryClient = useQueryClient();
	ensureEwDeskNewsBlobCacheRevoke(queryClient);

	const cacheKey = path ?? '';
	const query = useQuery({
		...ewDeskNewsBlobQueryOptions(cacheKey, async (): Promise<string> => {
			if (!path) throw new Error('missing path');
			const blob = await api.get<Blob>(path, { responseType: 'blob' });
			const url = URL.createObjectURL(blob);
			return registerBlobRevoke(cacheKey, url);
		}),
		enabled: enabled && Boolean(path),
	});

	return {
		blobUrl: query.data ?? null,
		isLoading: query.isLoading,
		failed: query.isError,
	};
}
