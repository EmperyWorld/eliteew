/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hook contract — pending reload banner uses one threshold timeout (no 500ms poll).
 *
 * Related:
 * - useCompanionPendingReloadDelay.ts
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCompanionPendingReloadDelay } from '@/features/ewa/companionUx/useCompanionPendingReloadDelay';

describe('useCompanionPendingReloadDelay', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('schedules a single threshold timeout (not an interval poll)', () => {
		const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
		const setIntervalSpy = vi.spyOn(window, 'setInterval');

		const { result } = renderHook(() =>
			useCompanionPendingReloadDelay({
				pending: true,
				streamingText: '',
				thresholdMs: 8_000,
			})
		);

		expect(result.current).toBe(false);
		expect(setIntervalSpy).not.toHaveBeenCalled();
		expect(setTimeoutSpy.mock.calls.some((call) => call[1] === 8_000)).toBe(
			true
		);

		act(() => {
			vi.advanceTimersByTime(7_999);
		});
		expect(result.current).toBe(false);

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current).toBe(true);

		setTimeoutSpy.mockRestore();
		setIntervalSpy.mockRestore();
	});

	it('resets when streaming tokens arrive', () => {
		const { result, rerender } = renderHook(
			(props: { pending: boolean; streamingText: string }) =>
				useCompanionPendingReloadDelay({
					pending: props.pending,
					streamingText: props.streamingText,
					thresholdMs: 1_000,
				}),
			{ initialProps: { pending: true, streamingText: '' } }
		);

		act(() => {
			vi.advanceTimersByTime(1_000);
		});
		expect(result.current).toBe(true);

		rerender({ pending: true, streamingText: 'hello' });
		expect(result.current).toBe(false);
	});
});
