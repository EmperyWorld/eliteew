/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock CM blob fetch concurrency cap, batch scheduler, and shared gate (plan W0.10 / W4).
 * @vitest-environment node
 *
 * Related:
 * - contentManagerBlobFetchConcurrency.ts
 * - documentation/platform/API-AUTH-SESSION-POOL-AND-CONTENT-BLOB-PERF-PLAN.md
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
	CM_BLOB_FETCH_MAX_CONCURRENT,
	resetBlobFetchConcurrencyForTests,
	runWithBlobFetchConcurrency,
	withBlobFetchConcurrency,
} from './contentManagerBlobFetchConcurrency';

describe('contentManagerBlobFetchConcurrency', () => {
	afterEach(() => {
		resetBlobFetchConcurrencyForTests();
	});

	it('locks default cap at 6 (I6 / pool headroom)', () => {
		expect(CM_BLOB_FETCH_MAX_CONCURRENT).toBe(6);
	});

	it('never exceeds concurrency limit', async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		const tasks = Array.from({ length: 20 }, (_, id) => async () => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await Promise.resolve();
			inFlight -= 1;
			return id;
		});
		const out = await runWithBlobFetchConcurrency(tasks, 4);
		expect(out).toEqual(Array.from({ length: 20 }, (_, i) => i));
		expect(maxInFlight).toBeLessThanOrEqual(4);
	});

	it('rejects invalid limit', async () => {
		await expect(
			runWithBlobFetchConcurrency([async () => 1], 0)
		).rejects.toThrow(/limit/);
	});

	it('withBlobFetchConcurrency gates independent callers', async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		const work = () =>
			withBlobFetchConcurrency(async () => {
				inFlight += 1;
				maxInFlight = Math.max(maxInFlight, inFlight);
				await new Promise((r) => setTimeout(r, 5));
				inFlight -= 1;
				return true;
			}, 2);
		await Promise.all(Array.from({ length: 8 }, () => work()));
		expect(maxInFlight).toBeLessThanOrEqual(2);
	});
});
