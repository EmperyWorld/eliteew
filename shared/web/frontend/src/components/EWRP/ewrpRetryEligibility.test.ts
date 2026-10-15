import { describe, expect, it } from 'vitest';
import { EWRP_HISTORY_STALE_AFTER_MS } from './EwrpGeneratorChunks';
import {
	ewrpJobCanRetry,
	ewrpJobRetryRequiresBilling,
} from './ewrpRetryEligibility';

describe('ewrpRetryEligibility', () => {
	it('allows retry for failed jobs', () => {
		expect(ewrpJobCanRetry('failed', null)).toBe(true);
		expect(ewrpJobRetryRequiresBilling('failed')).toBe(true);
	});

	it('allows retry for stale queued jobs without billing', () => {
		const now = Date.now();
		const staleIso = new Date(
			now - EWRP_HISTORY_STALE_AFTER_MS - 1000
		).toISOString();
		expect(ewrpJobCanRetry('queued', staleIso, now)).toBe(true);
		expect(ewrpJobRetryRequiresBilling('queued')).toBe(false);
	});

	it('rejects retry for fresh in-progress jobs', () => {
		const now = Date.now();
		const recent = new Date(now - 60_000).toISOString();
		expect(ewrpJobCanRetry('generating_images', recent, now)).toBe(false);
	});
});
