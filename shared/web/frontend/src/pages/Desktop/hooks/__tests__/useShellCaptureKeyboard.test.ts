/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for shell overlay capture keyboard hooks.
 *
 * Related:
 * - hooks/useShellCaptureKeyboard.ts
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	consumeEscapeForSearchClear,
	handleSearchFieldEscapeKeyDown,
	useShellCaptureEscape,
	useShellCaptureKeyboard,
} from '../useShellCaptureKeyboard';

describe('consumeEscapeForSearchClear', () => {
	it('clears non-empty search and returns true', () => {
		const clearSearch = vi.fn();
		expect(consumeEscapeForSearchClear('  q  ', clearSearch)).toBe(true);
		expect(clearSearch).toHaveBeenCalledTimes(1);
	});

	it('returns false when search is empty', () => {
		const clearSearch = vi.fn();
		expect(consumeEscapeForSearchClear('   ', clearSearch)).toBe(false);
		expect(clearSearch).not.toHaveBeenCalled();
	});
});

describe('handleSearchFieldEscapeKeyDown', () => {
	it('stops propagation when search was cleared', () => {
		const clearSearch = vi.fn();
		const preventDefault = vi.fn();
		const stopPropagation = vi.fn();

		handleSearchFieldEscapeKeyDown(
			{
				key: 'Escape',
				preventDefault,
				stopPropagation,
			},
			'query',
			clearSearch
		);

		expect(clearSearch).toHaveBeenCalledTimes(1);
		expect(preventDefault).toHaveBeenCalledTimes(1);
		expect(stopPropagation).toHaveBeenCalledTimes(1);
	});

	it('ignores non-Escape keys', () => {
		const clearSearch = vi.fn();
		handleSearchFieldEscapeKeyDown(
			{
				key: 'Enter',
				preventDefault: vi.fn(),
				stopPropagation: vi.fn(),
			},
			'query',
			clearSearch
		);
		expect(clearSearch).not.toHaveBeenCalled();
	});
});

describe('useShellCaptureEscape', () => {
	it('closes on Escape with stopPropagation', () => {
		const onEscape = vi.fn();
		const outer = vi.fn();
		window.addEventListener('keydown', outer);

		renderHook(() => useShellCaptureEscape(true, onEscape));

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				})
			);
		});

		expect(onEscape).toHaveBeenCalledTimes(1);
		expect(outer).not.toHaveBeenCalled();

		window.removeEventListener('keydown', outer);
	});

	it('consumes Escape via onLayer without calling onEscape', () => {
		const onEscape = vi.fn();
		const onLayer = vi.fn(() => true);

		renderHook(() => useShellCaptureEscape(true, onEscape, { onLayer }));

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				})
			);
		});

		expect(onLayer).toHaveBeenCalledTimes(1);
		expect(onEscape).not.toHaveBeenCalled();
	});

	it('clears search on first Escape then closes on second', () => {
		let search = 'docs';
		const onEscape = vi.fn();
		const clearSearch = vi.fn(() => {
			search = '';
		});

		renderHook(() =>
			useShellCaptureEscape(true, onEscape, {
				onLayer: () => consumeEscapeForSearchClear(search, clearSearch),
			})
		);

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				})
			);
		});

		expect(clearSearch).toHaveBeenCalledTimes(1);
		expect(onEscape).not.toHaveBeenCalled();

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				})
			);
		});

		expect(onEscape).toHaveBeenCalledTimes(1);
	});
});

describe('useShellCaptureKeyboard', () => {
	it('does not listen when inactive', () => {
		const handler = vi.fn();
		renderHook(() => useShellCaptureKeyboard(false, handler));

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
			);
		});

		expect(handler).not.toHaveBeenCalled();
	});
});
