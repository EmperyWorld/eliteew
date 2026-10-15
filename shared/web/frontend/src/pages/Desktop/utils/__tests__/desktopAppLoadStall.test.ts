/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock P18 desktop app load stall threshold + hook escalate timing.
 *
 * Related:
 * - ../desktopAppLoadStall.ts
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DESKTOP_APP_LOAD_STALL_MS,
	useDesktopAppLoadStall,
} from '../desktopAppLoadStall';

describe('desktopAppLoadStall', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('exports 8000ms default stall threshold', () => {
		expect(DESKTOP_APP_LOAD_STALL_MS).toBe(8_000);
	});

	it('escalates to stalled after stallMs while active', () => {
		const { result } = renderHook(() => useDesktopAppLoadStall(true, 100));
		expect(result.current).toBe(false);
		act(() => {
			vi.advanceTimersByTime(99);
		});
		expect(result.current).toBe(false);
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current).toBe(true);
	});

	it('resets when active becomes false', () => {
		const { result, rerender } = renderHook(
			({ active }) => useDesktopAppLoadStall(active, 50),
			{ initialProps: { active: true } }
		);
		act(() => {
			vi.advanceTimersByTime(50);
		});
		expect(result.current).toBe(true);
		rerender({ active: false });
		expect(result.current).toBe(false);
	});
});
