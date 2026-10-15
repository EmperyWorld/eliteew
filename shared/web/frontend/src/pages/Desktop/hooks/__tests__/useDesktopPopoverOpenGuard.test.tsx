/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for shared open-click guard used by Start menu and pinned apps modal.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesktopPopoverOpenGuard } from '@/pages/Desktop/hooks/useDesktopPopoverOpenGuard';

describe('useDesktopPopoverOpenGuard', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('arms guard when popover opens and clears after default delay', () => {
		const { result, rerender } = renderHook(
			({ isOpen }) => useDesktopPopoverOpenGuard(isOpen),
			{ initialProps: { isOpen: false } }
		);

		expect(result.current.current).toBe(false);

		rerender({ isOpen: true });
		expect(result.current.current).toBe(true);

		act(() => {
			vi.advanceTimersByTime(319);
		});
		expect(result.current.current).toBe(true);

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current.current).toBe(false);
	});

	it('clears guard immediately when popover closes', () => {
		const { result, rerender } = renderHook(
			({ isOpen }) => useDesktopPopoverOpenGuard(isOpen, 320),
			{ initialProps: { isOpen: true } }
		);

		expect(result.current.current).toBe(true);

		rerender({ isOpen: false });
		expect(result.current.current).toBe(false);
	});

	it('respects custom delay', () => {
		const { result, rerender } = renderHook(
			({ isOpen }) => useDesktopPopoverOpenGuard(isOpen, 100),
			{ initialProps: { isOpen: false } }
		);

		rerender({ isOpen: true });
		expect(result.current.current).toBe(true);

		act(() => {
			vi.advanceTimersByTime(100);
		});
		expect(result.current.current).toBe(false);
	});
});
