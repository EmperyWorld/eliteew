/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify shell search refocus on open and tab visibility return.
 *
 * Related:
 * - hooks/useDesktopShellSearchFocusOnVisible.ts
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDesktopShellSearchFocusOnVisible } from '@/pages/Desktop/hooks/useDesktopShellSearchFocusOnVisible';

const focusDesktopShellSearchInput = vi.fn();

vi.mock('@/pages/Desktop/utils/desktopShellSearchAutofocus', () => ({
	focusDesktopShellSearchInput: (input: HTMLInputElement | null | undefined) =>
		focusDesktopShellSearchInput(input),
}));

describe('useDesktopShellSearchFocusOnVisible', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		focusDesktopShellSearchInput.mockClear();
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'visible',
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('focuses when panel opens', () => {
		const input = document.createElement('input');
		const inputRef = { current: input };

		renderHook(() => useDesktopShellSearchFocusOnVisible(inputRef, true));

		expect(focusDesktopShellSearchInput).toHaveBeenCalledWith(input);
	});

	it('refocuses when tab becomes visible while panel stays open', () => {
		const input = document.createElement('input');
		const inputRef = { current: input };

		renderHook(() => useDesktopShellSearchFocusOnVisible(inputRef, true));
		focusDesktopShellSearchInput.mockClear();

		act(() => {
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				value: 'hidden',
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});
		expect(focusDesktopShellSearchInput).not.toHaveBeenCalled();

		act(() => {
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				value: 'visible',
			});
			document.dispatchEvent(new Event('visibilitychange'));
		});
		expect(focusDesktopShellSearchInput).toHaveBeenCalledWith(input);
	});
});
