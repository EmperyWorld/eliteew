/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Post-paint gutter scheduling via requestAnimationFrame (no idle placeholder gap).
 *
 * Related:
 * - tiptapGutterLayoutScheduling.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	cancelGutterLayoutFrame,
	scheduleGutterBackgroundFullLayout,
	scheduleGutterPostPaintWork,
} from './tiptapGutterLayoutScheduling';

describe('tiptapGutterLayoutScheduling', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('runs layout only after double requestAnimationFrame', () => {
		const run = vi.fn();
		const rafQueue: FrameRequestCallback[] = [];
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			rafQueue.push(cb);
			return rafQueue.length;
		});

		scheduleGutterPostPaintWork(run);
		expect(run).not.toHaveBeenCalled();

		rafQueue.shift()?.(0);
		expect(run).not.toHaveBeenCalled();

		rafQueue.shift()?.(0);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('scheduleGutterBackgroundFullLayout uses the same double-rAF contract', () => {
		const run = vi.fn();
		const rafQueue: FrameRequestCallback[] = [];
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			rafQueue.push(cb);
			return rafQueue.length;
		});

		scheduleGutterBackgroundFullLayout(run);
		expect(run).not.toHaveBeenCalled();

		rafQueue.shift()?.(0);
		rafQueue.shift()?.(0);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('cancelGutterLayoutFrame clears pending animation frame', () => {
		const cancel = vi.spyOn(window, 'cancelAnimationFrame');
		cancelGutterLayoutFrame(17);
		expect(cancel).toHaveBeenCalledWith(17);
	});
});
