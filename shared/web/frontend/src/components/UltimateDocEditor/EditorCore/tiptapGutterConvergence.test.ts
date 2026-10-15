/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Final convergence + double-jump guards for gutter boot pipeline.
 *
 * Related:
 * - tiptapGutterTransition.ts
 * - tiptapGutterLayoutScheduling.ts
 * - TiptapEditor.tsx
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleGutterPostPaintWork } from './tiptapGutterLayoutScheduling';
import {
	applyStableGutterHeight,
	createGutterTransitionState,
	markGutterFullReady,
	markGutterViewportReady,
	resolveGutterHeightForPhase,
	resolveStableGutterHeight,
} from './tiptapGutterTransition';

function simulateBootHeightPipeline(contentScrollHeightPx: number): number[] {
	const state = createGutterTransitionState();
	const heights: number[] = [];

	heights.push(applyStableGutterHeight(state, contentScrollHeightPx));
	markGutterViewportReady(state);

	heights.push(applyStableGutterHeight(state, contentScrollHeightPx));
	heights.push(applyStableGutterHeight(state, contentScrollHeightPx));

	markGutterFullReady(state);
	heights.push(
		resolveGutterHeightForPhase(state, contentScrollHeightPx, 'full')
	);

	return heights;
}

describe('tiptapGutterConvergence', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('Final Convergence — full phase height equals content scrollHeight exactly', () => {
		const contentHeight = 4800;
		const state = createGutterTransitionState();
		applyStableGutterHeight(state, 6200);
		markGutterViewportReady(state);
		markGutterFullReady(state);

		const converged = resolveGutterHeightForPhase(state, contentHeight, 'full');

		expect(converged).toBe(contentHeight);
		expect(state.stableHeightPx).toBe(contentHeight);
		expect(converged).toBe(resolveStableGutterHeight(contentHeight));
	});

	it('Double-Jump guard — boot skeleton, rAF passes, and full converge to same height', () => {
		const contentHeight = 4800;
		const heights = simulateBootHeightPipeline(contentHeight);
		const expected = resolveStableGutterHeight(contentHeight);

		expect(heights).toHaveLength(4);
		for (const height of heights) {
			expect(height).toBe(expected);
		}
	});

	it('Double-Jump guard — rAF pipeline does not mutate height when scrollHeight is stable', () => {
		const runHeightRead = vi.fn(() =>
			applyStableGutterHeight(createGutterTransitionState(), 3200)
		);
		const rafQueue: FrameRequestCallback[] = [];
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			rafQueue.push(cb);
			return rafQueue.length;
		});

		scheduleGutterPostPaintWork(runHeightRead);
		rafQueue.shift()?.(0);
		rafQueue.shift()?.(0);

		expect(runHeightRead).toHaveBeenCalledTimes(1);
		expect(runHeightRead.mock.results[0]?.value).toBe(3200);
	});

	it('does not leave over-expanded ghost height after full convergence', () => {
		const state = createGutterTransitionState();
		applyStableGutterHeight(state, 9000);
		expect(state.stableHeightPx).toBe(9000);

		markGutterFullReady(state);
		const converged = resolveGutterHeightForPhase(state, 4100, 'full');

		expect(converged).toBe(4100);
		expect(state.stableHeightPx).toBe(4100);
	});
});
