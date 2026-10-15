/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for visibility-aware interval hook.
 *
 * Related:
 * - src/pages/Desktop/hooks/useVisibilityAwareInterval.ts
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVisibilityAwareInterval } from '@/pages/Desktop/hooks/useVisibilityAwareInterval';

describe('useVisibilityAwareInterval', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('runs immediately and on each interval tick when enabled', () => {
		const callback = vi.fn();
		renderHook(() => useVisibilityAwareInterval(callback, 1000, true));

		expect(callback).toHaveBeenCalledTimes(1);

		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(callback).toHaveBeenCalledTimes(2);
	});

	it('does not schedule when disabled', () => {
		const callback = vi.fn();
		renderHook(() => useVisibilityAwareInterval(callback, 1000, false));
		expect(callback).not.toHaveBeenCalled();
	});

	it('runs immediately when tab becomes visible again', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'hidden',
		});

		const callback = vi.fn();
		renderHook(() => useVisibilityAwareInterval(callback, 1000, true));
		expect(callback).toHaveBeenCalledTimes(1);
		callback.mockClear();

		act(() => {
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				value: 'visible',
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});

		expect(callback).toHaveBeenCalledTimes(1);
	});
});
