/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared conditional GET (ETag + 304) for any namespaced cache key.
 * Axios rejects 304 unless validateStatus allows it; empty 304 bodies reuse last 200 JSON.
 *
 * Invariants:
 * - Session-scoped ETag/body maps are cleared via `clearFeSessionApiCaches` on logout.
 *
 * Related:
 * - `services/api/cacheInvalidationLogger.ts`, `pages/Desktop/services/desktopConditionalGet.ts`
 */

import type {
	AxiosHeaders,
	AxiosRequestConfig,
	AxiosResponseHeaders,
	RawAxiosResponseHeaders,
} from 'axios';
import { apiClient } from './client';
import { logCacheInvalidation } from './cacheInvalidationLogger';

/** Read weak ETag from axios response headers (case-insensitive). */
export function readAxiosResponseEtag(
	headers: AxiosResponseHeaders | RawAxiosResponseHeaders | undefined
): string | null {
	if (!headers) return null;
	const raw =
		typeof (headers as AxiosHeaders).get === 'function'
			? (headers as AxiosHeaders).get('etag')
			: ((headers as Record<string, unknown>).etag ??
				(headers as Record<string, unknown>).ETag);
	return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

const etagByKey = new Map<string, string>();
const bodyByKey = new Map<string, unknown>();

export function invalidateConditionalJsonKey(cacheKey: string): void {
	etagByKey.delete(cacheKey);
	bodyByKey.delete(cacheKey);
}

export function getConditionalJsonEtag(cacheKey: string): string | null {
	return etagByKey.get(cacheKey) ?? null;
}

export function updateConditionalJsonCache(
	cacheKey: string,
	body: unknown,
	etag: string | null
): void {
	if (etag && etag.length > 0) {
		etagByKey.set(cacheKey, etag);
	} else {
		etagByKey.delete(cacheKey);
	}
	bodyByKey.set(cacheKey, body);
}

export function invalidateConditionalJsonKeysByPrefix(prefix: string): void {
	for (const k of [...etagByKey.keys()]) {
		if (k.startsWith(prefix)) {
			etagByKey.delete(k);
			bodyByKey.delete(k);
		}
	}
}

export function invalidateAllConditionalJsonCaches(): void {
	etagByKey.clear();
	bodyByKey.clear();
}

/**
 * Call on logout (or full session reset) so ETag/body caches never leak across users.
 * In-memory desktop shell cache remains `clearDesktopShellStateCache()` in `desktopApi`.
 */
export function clearFeSessionApiCaches(): void {
	const keyCount = etagByKey.size;
	invalidateAllConditionalJsonCaches();
	logCacheInvalidation('clearFeSessionApiCaches', {
		clearedKeys: keyCount,
	});
}

/**
 * GET JSON with optional If-None-Match; on 304 returns cached body from the last 200.
 * Use stable keys with a namespace prefix (e.g. `desktop:config`, `friends:overview`).
 */
export async function conditionalJsonGet<T>(
	cacheKey: string,
	url: string,
	options?: AxiosRequestConfig
): Promise<T> {
	const etag = etagByKey.get(cacheKey);
	const merged: AxiosRequestConfig = {
		...options,
		validateStatus: (status) =>
			(status >= 200 && status < 300) || status === 304,
		headers: {
			...(options?.headers as Record<string, string> | undefined),
			...(etag ? { 'If-None-Match': etag } : {}),
		},
	};

	const response = await apiClient.get<T>(url, merged);

	if (response.status === 304) {
		const cached = bodyByKey.get(cacheKey);
		if (cached === undefined) {
			logCacheInvalidation('conditionalJsonGet etag desync retry', {
				cacheKey,
				url,
			});
			etagByKey.delete(cacheKey);
			return conditionalJsonGet<T>(cacheKey, url, options);
		}
		logCacheInvalidation('conditionalJsonGet 304 short-circuit', {
			cacheKey,
			url,
			etag,
		});
		return cached as T;
	}

	const rawEtag = readAxiosResponseEtag(response.headers);
	if (rawEtag) {
		etagByKey.set(cacheKey, rawEtag);
	} else {
		etagByKey.delete(cacheKey);
	}
	bodyByKey.set(cacheKey, response.data as unknown);
	return response.data;
}
