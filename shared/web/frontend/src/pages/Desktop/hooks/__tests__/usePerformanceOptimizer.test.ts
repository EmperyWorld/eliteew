/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for desktop shell performance telemetry.
 *
 * Invariants:
 * - Frame metrics come from the rAF cadence, not from static target budgets.
 *
 * Related:
 * - src/pages/Desktop/hooks/usePerformanceOptimizer.ts
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePerformanceOptimizer } from '../usePerformanceOptimizer';

describe('usePerformanceOptimizer', () => {
	let rafCallbacks: Map<number, FrameRequestCallback>;
	let nextRafId: number;
	let longTaskCallback:
		| ((list: { getEntries: () => Array<{ duration: number }> }) => void)
		| null;

	function defineDocumentVisibility(hidden: boolean) {
		Object.defineProperty(document, 'hidden', {
			configurable: true,
			value: hidden,
		});
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: hidden ? 'hidden' : 'visible',
		});
	}

	function flushNextFrame(now: number) {
		const entry = rafCallbacks.entries().next().value;
		if (!entry) {
			throw new Error('No pending rAF callback');
		}
		const [id, callback] = entry;
		rafCallbacks.delete(id);
		act(() => {
			callback(now);
		});
	}

	function flushFrameRange(start: number, end: number, step: number) {
		for (let now = start; now <= end; now += step) {
			flushNextFrame(now);
		}
	}

	beforeEach(() => {
		vi.useFakeTimers();
		defineDocumentVisibility(false);
		rafCallbacks = new Map();
		nextRafId = 1;
		longTaskCallback = null;
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
			const id = nextRafId++;
			rafCallbacks.set(id, callback);
			return id;
		});
		vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
			rafCallbacks.delete(id);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('publishes measured frame cadence instead of the static target budget', () => {
		const { result, unmount } = renderHook(() =>
			usePerformanceOptimizer({ windowCount: 2 })
		);

		flushFrameRange(0, 1050, 50);

		expect(result.current.metrics.windowCount).toBe(2);
		expect(result.current.metrics.fps).toBe(20);
		expect(result.current.metrics.renderTime).toBe(50);
		expect(result.current.recommendations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'low_fps',
					values: expect.objectContaining({ fps: 20 }),
				}),
			])
		);

		unmount();
		expect(rafCallbacks.size).toBe(0);
	});

	it('throttles frame metric publication so telemetry does not rerender every frame', () => {
		const { result } = renderHook(() => usePerformanceOptimizer());

		flushNextFrame(0);
		flushNextFrame(16);

		expect(result.current.metrics.fps).toBe(60);
		expect(result.current.metrics.renderTime).toBe(0);

		flushNextFrame(32);
		flushNextFrame(48);
		flushNextFrame(64);

		expect(result.current.metrics.fps).toBe(60);
		expect(result.current.metrics.renderTime).toBe(0);

		flushNextFrame(1024);

		expect(result.current.metrics.fps).toBeGreaterThan(0);
		expect(result.current.metrics.renderTime).toBeGreaterThan(0);
	});

	it('pauses frame sampling while the tab is hidden', () => {
		const { unmount } = renderHook(() => usePerformanceOptimizer());

		expect(rafCallbacks.size).toBe(1);
		act(() => {
			defineDocumentVisibility(true);
			document.dispatchEvent(new Event('visibilitychange'));
		});

		expect(rafCallbacks.size).toBe(0);
		unmount();
	});

	it('skips continuous rAF when frameSamplingEnabled is false', () => {
		const { unmount } = renderHook(() =>
			usePerformanceOptimizer({ frameSamplingEnabled: false })
		);

		expect(rafCallbacks.size).toBe(0);
		expect(window.requestAnimationFrame).not.toHaveBeenCalled();
		unmount();
	});

	it('records action-scoped shell performance markers', () => {
		const { result } = renderHook(() => usePerformanceOptimizer());

		act(() => {
			result.current.recordShellAction('window-drag-commit', 12.34);
		});

		expect(result.current.metrics.lastAction).toMatchObject({
			name: 'window-drag-commit',
			durationMs: 12.3,
		});
		expect(result.current.metrics.actionSampleCount).toBe(1);
	});

	it('samples browser long tasks when PerformanceObserver supports them', () => {
		class MockPerformanceObserver {
			static supportedEntryTypes = ['longtask'];
			constructor(
				callback: (list: {
					getEntries: () => Array<{ duration: number }>;
				}) => void
			) {
				longTaskCallback = callback;
			}
			observe = vi.fn();
			disconnect = vi.fn();
		}
		vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);

		const { result } = renderHook(() => usePerformanceOptimizer());
		expect(result.current.metrics.longTaskSupported).toBe(true);

		act(() => {
			longTaskCallback?.({
				getEntries: () => [{ duration: 72.44 }, { duration: 50 }],
			});
		});

		expect(result.current.metrics.longTaskCount).toBe(2);
		expect(result.current.metrics.lastLongTaskMs).toBe(72.4);
		expect(result.current.recommendations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'long_task',
					values: expect.objectContaining({ ms: 72.4 }),
				}),
			])
		);
	});
});
