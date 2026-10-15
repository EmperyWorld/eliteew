/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock document capture default-deny for native ПКМ on the desktop shell.
 *
 * Invariants:
 * - Capture listener suppresses non-editable targets without stopPropagation.
 * - `[data-desktop-allow-native-context]` and editables skip suppress.
 *
 * Related:
 * - useDesktopShellNativeContextMenuDeny.ts
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDesktopShellNativeContextMenuDeny } from '../useDesktopShellNativeContextMenuDeny';

describe('useDesktopShellNativeContextMenuDeny', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('suppresses native menu on non-editable chrome via capture', () => {
		renderHook(() => useDesktopShellNativeContextMenuDeny(true));
		const div = document.createElement('div');
		document.body.appendChild(div);
		const event = new MouseEvent('contextmenu', {
			bubbles: true,
			cancelable: true,
		});
		const stopSpy = vi.spyOn(event, 'stopPropagation');
		div.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		expect(stopSpy).not.toHaveBeenCalled();
	});

	it('allows native menu on editable and escape-hatch targets', () => {
		renderHook(() => useDesktopShellNativeContextMenuDeny(true));

		const textarea = document.createElement('textarea');
		document.body.appendChild(textarea);
		const editableEvent = new MouseEvent('contextmenu', {
			bubbles: true,
			cancelable: true,
		});
		textarea.dispatchEvent(editableEvent);
		expect(editableEvent.defaultPrevented).toBe(false);

		const allowNativeHost = document.createElement('div');
		allowNativeHost.setAttribute('data-desktop-allow-native-context', '');
		document.body.appendChild(allowNativeHost);
		const allowNativeEvent = new MouseEvent('contextmenu', {
			bubbles: true,
			cancelable: true,
		});
		allowNativeHost.dispatchEvent(allowNativeEvent);
		expect(allowNativeEvent.defaultPrevented).toBe(false);
	});

	it('does not register when disabled', () => {
		const addSpy = vi.spyOn(document, 'addEventListener');
		renderHook(() => useDesktopShellNativeContextMenuDeny(false));
		expect(
			addSpy.mock.calls.some(
				([type, , options]) =>
					type === 'contextmenu' &&
					(options === true ||
						(typeof options === 'object' &&
							options !== null &&
							'capture' in options &&
							options.capture === true))
			)
		).toBe(false);
		addSpy.mockRestore();
	});
});
