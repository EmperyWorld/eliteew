/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for pure AMKA refetch interval helpers (polling vs active runs, SSE live gate).
 *
 * Invariants:
 * - No network; exercises `computeAmkaRunsListRefetchMs` / `computeAmkaRunDetailRefetchMs` only.
 *
 * Related:
 * - src/hooks/api/useAmka.ts
 */
import { describe, expect, it } from 'vitest';

import {
	AMKA_POLL_FLOOR_MS,
	computeAmkaRunDetailRefetchMs,
	computeAmkaRunsListRefetchMs,
} from '../useAmka';

describe('computeAmkaRunsListRefetchMs', () => {
	it('returns false when there is no active run', () => {
		expect(
			computeAmkaRunsListRefetchMs({ hasActive: false, pollAfterMs: 1000 })
		).toBe(false);
	});

	it('uses max(floor, poll_after_ms) when API suggests a shorter interval', () => {
		expect(
			computeAmkaRunsListRefetchMs({ hasActive: true, pollAfterMs: 500 })
		).toBe(AMKA_POLL_FLOOR_MS);
	});

	it('uses poll_after_ms when it is above the floor', () => {
		expect(
			computeAmkaRunsListRefetchMs({ hasActive: true, pollAfterMs: 12_000 })
		).toBe(12_000);
	});

	it('falls back to the floor when poll_after_ms is missing', () => {
		expect(
			computeAmkaRunsListRefetchMs({ hasActive: true, pollAfterMs: null })
		).toBe(AMKA_POLL_FLOOR_MS);
	});
});

describe('computeAmkaRunDetailRefetchMs', () => {
	it('disables polling while the SSE stream is considered live', () => {
		expect(
			computeAmkaRunDetailRefetchMs({
				status: 'running',
				pollAfterMs: 12_000,
				progressStreamLive: true,
			})
		).toBe(false);
	});

	it('uses max(floor, poll_after_ms) for an active run when SSE is off', () => {
		expect(
			computeAmkaRunDetailRefetchMs({
				status: 'running',
				pollAfterMs: 500,
				progressStreamLive: false,
			})
		).toBe(AMKA_POLL_FLOOR_MS);
	});

	it('returns false for failed run (terminal — no poll)', () => {
		expect(
			computeAmkaRunDetailRefetchMs({
				status: 'failed',
				pollAfterMs: 8000,
				progressStreamLive: false,
			})
		).toBe(false);
	});

	it('returns false for cancelled run (terminal — no poll)', () => {
		expect(
			computeAmkaRunDetailRefetchMs({
				status: 'cancelled',
				pollAfterMs: 8000,
				progressStreamLive: false,
			})
		).toBe(false);
	});
});
