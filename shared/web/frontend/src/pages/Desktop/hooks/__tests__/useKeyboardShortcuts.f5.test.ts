import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts F5', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('calls onRefresh and preventDefault when handler is set', () => {
		const onRefresh = vi.fn();
		renderHook(() => useKeyboardShortcuts({ onRefresh }));

		const ev = new KeyboardEvent('keydown', { key: 'F5', bubbles: true });
		const pd = vi.spyOn(ev, 'preventDefault');
		act(() => {
			window.dispatchEvent(ev);
		});
		expect(onRefresh).toHaveBeenCalledTimes(1);
		expect(pd).toHaveBeenCalled();
	});

	it('does not preventDefault when onRefresh is omitted', () => {
		renderHook(() => useKeyboardShortcuts({}));

		const ev = new KeyboardEvent('keydown', { key: 'F5', bubbles: true });
		const pd = vi.spyOn(ev, 'preventDefault');
		act(() => {
			window.dispatchEvent(ev);
		});
		expect(pd).not.toHaveBeenCalled();
	});
});
