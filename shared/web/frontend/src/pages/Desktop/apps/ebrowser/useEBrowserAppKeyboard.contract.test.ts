/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: while typing in find input, Ctrl/Cmd+L/T/W do not fire chrome actions.
 */

import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEBrowserAppKeyboard } from '@/pages/Desktop/apps/ebrowser/useEBrowserAppKeyboard';

describe('useEBrowserAppKeyboard', () => {
	it('ignores Ctrl+L/T/W while find input is focused', () => {
		const findInput = document.createElement('input');
		document.body.appendChild(findInput);
		const addressInput = document.createElement('input');
		document.body.appendChild(addressInput);
		const findInputRef = { current: findInput };
		const addressInputRef = { current: addressInput };
		const focusSpy = vi.spyOn(addressInput, 'focus');

		const onNewTab = vi.fn();
		const onCloseActiveTab = vi.fn();
		const onOpenFind = vi.fn();

		renderHook(() =>
			useEBrowserAppKeyboard({
				enabled: true,
				opened: true,
				addressInputRef,
				findInputRef,
				findOpen: true,
				onOpenFind,
				onCloseFind: vi.fn(),
				onNewTab,
				onCloseActiveTab,
				onZoomIn: vi.fn(),
				onZoomOut: vi.fn(),
				onZoomReset: vi.fn(),
			})
		);

		findInput.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'l',
				ctrlKey: true,
				bubbles: true,
			})
		);
		findInput.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 't',
				ctrlKey: true,
				bubbles: true,
			})
		);
		findInput.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'w',
				ctrlKey: true,
				bubbles: true,
			})
		);
		expect(focusSpy).not.toHaveBeenCalled();
		expect(onNewTab).not.toHaveBeenCalled();
		expect(onCloseActiveTab).not.toHaveBeenCalled();

		findInput.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'f',
				ctrlKey: true,
				bubbles: true,
			})
		);
		expect(onOpenFind).toHaveBeenCalledTimes(1);

		findInput.remove();
		addressInput.remove();
	});
});
