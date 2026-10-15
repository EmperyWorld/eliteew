/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for recovery quote rotation interval and no-repeat contract.
 *
 * Invariants:
 * - Pool size > 1 rotates on interval; consecutive quotes differ.
 *
 * Related:
 * - `useRotatingEliteQuote.ts`
 * - `types.ts` (`ELITE_QUOTE_ROTATION_MS`)
 */

import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ELITE_QUOTE_ROTATION_MS, ELITE_RECOVERY_QUOTE_POOL } from '../index';
import { useRotatingEliteQuote } from '../useRotatingEliteQuote';

describe('useRotatingEliteQuote', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('rotates recovery quotes every ELITE_QUOTE_ROTATION_MS', () => {
		expect(ELITE_QUOTE_ROTATION_MS).toBe(7000);
		expect(ELITE_RECOVERY_QUOTE_POOL.length).toBeGreaterThan(1);

		const { result } = renderHook(() =>
			useRotatingEliteQuote({
				category: ['perseverance', 'strategy'],
				intervalMs: ELITE_QUOTE_ROTATION_MS,
				seed: 1,
			})
		);

		const first = result.current;
		act(() => {
			vi.advanceTimersByTime(ELITE_QUOTE_ROTATION_MS);
		});
		const second = result.current;
		expect(second.id).not.toBe(first.id);

		act(() => {
			vi.advanceTimersByTime(ELITE_QUOTE_ROTATION_MS);
		});
		const third = result.current;
		expect(third.id).not.toBe(second.id);
	});

	it('does not rotate when intervalMs is zero', () => {
		const { result } = renderHook(() =>
			useRotatingEliteQuote({
				category: ['perseverance', 'strategy'],
				intervalMs: 0,
				seed: 2,
			})
		);

		const first = result.current;
		act(() => {
			vi.advanceTimersByTime(ELITE_QUOTE_ROTATION_MS * 3);
		});
		expect(result.current.id).toBe(first.id);
	});
});
