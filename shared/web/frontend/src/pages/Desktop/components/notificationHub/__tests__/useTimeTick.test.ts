/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for notification hub relative-time refresh tick.
 *
 * Related:
 * - components/notificationHub/useTimeTick.ts
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimeTick } from '../useTimeTick';

describe('useTimeTick', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('increments on aligned minute cadence', () => {
		vi.setSystemTime(new Date('2026-06-22T10:15:30Z'));
		const { result } = renderHook(() => useTimeTick(60_000));
		expect(result.current).toBe(0);

		act(() => {
			vi.advanceTimersByTime(30_000);
		});
		expect(result.current).toBe(1);

		act(() => {
			vi.advanceTimersByTime(60_000);
		});
		expect(result.current).toBe(2);
	});

	it('bumps immediately when tab becomes visible again', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'hidden',
		});

		const { result } = renderHook(() => useTimeTick(60_000));
		expect(result.current).toBe(0);

		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'visible',
		});

		act(() => {
			document.dispatchEvent(new Event('visibilitychange'));
		});

		expect(result.current).toBe(1);
	});
});
