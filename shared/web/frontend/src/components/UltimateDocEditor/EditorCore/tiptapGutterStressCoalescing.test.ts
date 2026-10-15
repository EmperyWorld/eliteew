/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stress-induced layout lag — burst scroll/resize/type coalescing budget.
 *
 * Related:
 * - tiptapGutterPromotionScheduler.ts
 * - tiptapGutterTransition.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createGutterPromotionScheduler,
	GUTTER_STRESS_BURST_WINDOW_MS,
	GUTTER_STRESS_COALESCED_LAYOUT_RUNS,
	GUTTER_STRESS_EVENT_COUNT,
	GUTTER_STRESS_SYNC_BUDGET_MS,
} from './tiptapGutterPromotionScheduler';
import {
	createGutterTransitionState,
	markGutterViewportReady,
	requestGutterFullLayoutPromotion,
} from './tiptapGutterTransition';

describe('tiptapGutterStressCoalescing', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('Stress-induced Layout Lag — 100 burst promotions coalesce to one layout run', () => {
		let layoutRuns = 0;
		const scheduler = createGutterPromotionScheduler(() => {
			layoutRuns += 1;
		}, 200);

		const startedAt = performance.now();
		for (let index = 0; index < GUTTER_STRESS_EVENT_COUNT; index += 1) {
			scheduler.requestPromotion();
		}
		const syncElapsedMs = performance.now() - startedAt;

		expect(scheduler.pendingPromotionCount()).toBe(GUTTER_STRESS_EVENT_COUNT);
		expect(syncElapsedMs).toBeLessThan(GUTTER_STRESS_SYNC_BUDGET_MS);

		vi.advanceTimersByTime(GUTTER_STRESS_BURST_WINDOW_MS);
		const runsAfterBurst = scheduler.flushPending();

		expect(runsAfterBurst).toBe(GUTTER_STRESS_COALESCED_LAYOUT_RUNS);
		expect(layoutRuns).toBe(GUTTER_STRESS_COALESCED_LAYOUT_RUNS);
		scheduler.dispose();
	});

	it('mixed scroll → resize → type burst during viewport phase accepts promotions without pending lock stickiness', () => {
		const state = createGutterTransitionState();
		markGutterViewportReady(state);

		let promotionsAccepted = 0;
		const startedAt = performance.now();
		for (let index = 0; index < GUTTER_STRESS_EVENT_COUNT; index += 1) {
			if (requestGutterFullLayoutPromotion(state)) {
				promotionsAccepted += 1;
			}
		}
		const syncElapsedMs = performance.now() - startedAt;

		expect(promotionsAccepted).toBe(GUTTER_STRESS_EVENT_COUNT);
		expect(state.pendingFullLayout).toBe(false);
		expect(syncElapsedMs).toBeLessThan(GUTTER_STRESS_SYNC_BUDGET_MS);
	});

	it('debounced scheduler resets a single active timer under rapid re-entry', () => {
		const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
		const scheduler = createGutterPromotionScheduler(() => {}, 200);

		for (let index = 0; index < GUTTER_STRESS_EVENT_COUNT; index += 1) {
			scheduler.requestPromotion();
		}

		expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(
			GUTTER_STRESS_EVENT_COUNT - 1
		);
		scheduler.dispose();
	});
});
