/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Structured debug traces for frontend session/API cache invalidation (ETag 304, shell 412, logout teardown).
 *
 * Invariants:
 * - Uses ServiceLogger.debug only — quiet in production default log levels.
 * - All messages use the `[CACHE]` prefix for grep-friendly observability.
 *
 * Related:
 * - `services/api/conditionalJsonGet.ts`, `pages/Desktop/services/desktopApi.ts`
 */

import { getServiceLogger } from '../core/ServiceLogger';

const cacheLogger = getServiceLogger('FeCache');

export function logCacheInvalidation(
	event: string,
	metadata?: Record<string, unknown>
): void {
	cacheLogger.debug(`[CACHE] ${event}`, metadata);
}

/** Test hook: underlying ServiceLogger instance for Vitest spies. */
export function getCacheInvalidationLogger() {
	return cacheLogger;
}
