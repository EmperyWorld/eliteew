/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bounded concurrency for Content Manager authenticated blob fetches.
 *
 * Invariants:
 * - Cap is explicit and ≤ typical SQLAlchemy pool headroom after Wave 1.
 * - `withBlobFetchConcurrency` gates independent grid/hover effects (Wave 4).
 * - `runWithBlobFetchConcurrency` remains for explicit task-list batching.
 *
 * Related:
 * - documentation/platform/API-AUTH-SESSION-POOL-AND-CONTENT-BLOB-PERF-PLAN.md
 * - documentation/product/FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md
 * - documentation/product/CONTENT-MANAGER.md §Auth session hold
 */

/** Max parallel thumbnail/download blob GETs from CM UI (shared across components). */
export const CM_BLOB_FETCH_MAX_CONCURRENT = 6;

let activeBlobFetches = 0;
const blobFetchWaiters: Array<() => void> = [];

function releaseBlobFetchSlot(): void {
	activeBlobFetches = Math.max(0, activeBlobFetches - 1);
	const next = blobFetchWaiters.shift();
	if (next) {
		activeBlobFetches += 1;
		next();
	}
}

async function acquireBlobFetchSlot(
	limit: number = CM_BLOB_FETCH_MAX_CONCURRENT
): Promise<void> {
	if (limit < 1) {
		throw new Error('withBlobFetchConcurrency: limit must be >= 1');
	}
	if (activeBlobFetches < limit) {
		activeBlobFetches += 1;
		return;
	}
	await new Promise<void>((resolve) => {
		blobFetchWaiters.push(resolve);
	});
}

/**
 * Run one async blob GET under the shared concurrency gate (FIFO waiters).
 * Use from ContentThumbnail / HoverPreview so N in-view cards cannot stampede.
 */
export async function withBlobFetchConcurrency<T>(
	fn: () => Promise<T>,
	limit: number = CM_BLOB_FETCH_MAX_CONCURRENT
): Promise<T> {
	await acquireBlobFetchSlot(limit);
	try {
		return await fn();
	} finally {
		releaseBlobFetchSlot();
	}
}

/** Test-only: clear semaphore state between Vitest cases. */
export function resetBlobFetchConcurrencyForTests(): void {
	activeBlobFetches = 0;
	blobFetchWaiters.length = 0;
}

/**
 * Run async tasks with a fixed concurrency limit (FIFO start order).
 * Rejects if `limit` < 1.
 */
export async function runWithBlobFetchConcurrency<T>(
	tasks: ReadonlyArray<() => Promise<T>>,
	limit: number = CM_BLOB_FETCH_MAX_CONCURRENT
): Promise<T[]> {
	if (limit < 1) {
		throw new Error('runWithBlobFetchConcurrency: limit must be >= 1');
	}
	if (tasks.length === 0) {
		return [];
	}
	const results: T[] = new Array(tasks.length);
	let nextIndex = 0;

	async function worker(): Promise<void> {
		for (;;) {
			const i = nextIndex;
			nextIndex += 1;
			if (i >= tasks.length) {
				return;
			}
			results[i] = await tasks[i]();
		}
	}

	const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
		worker()
	);
	await Promise.all(workers);
	return results;
}
