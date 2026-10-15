/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave D lock: ignore-context non-editable chrome suppresses native without
 * opening window chrome menu; editables still get text menu.
 *
 * Invariants:
 * - Non-editable under `data-desktop-window-ignore-context` → preventDefault.
 * - Editable under ignore-zone → text menu path (preventDefault + state).
 *
 * Related:
 * - useEnhancedWindowTextContextMenu.ts
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */
import { act, renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEnhancedWindowTextContextMenu } from '../useEnhancedWindowTextContextMenu';

function makeReactContextMenuEvent(target: EventTarget) {
	return {
		target,
		clientX: 40,
		clientY: 60,
		defaultPrevented: false,
		preventDefault: vi.fn(function (this: { defaultPrevented: boolean }) {
			this.defaultPrevented = true;
		}),
		stopPropagation: vi.fn(),
	} as unknown as ReactMouseEvent<HTMLElement>;
}

describe('useEnhancedWindowTextContextMenu ignore-context', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('suppresses native on non-editable ignore-context without chrome CustomEvent', () => {
		const { result } = renderHook(() =>
			useEnhancedWindowTextContextMenu('win-ignore')
		);
		const zone = document.createElement('div');
		zone.setAttribute('data-desktop-window-ignore-context', '');
		const chrome = document.createElement('button');
		zone.appendChild(chrome);
		document.body.appendChild(zone);

		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		const event = makeReactContextMenuEvent(chrome);
		act(() => {
			result.current.onBodyContextMenu(event);
		});

		expect(event.preventDefault).toHaveBeenCalled();
		expect(result.current.textContextMenu).toBeNull();
		expect(
			dispatchSpy.mock.calls.some(
				([ev]) =>
					ev instanceof CustomEvent && ev.type === 'desktop-window-context-menu'
			)
		).toBe(false);
		dispatchSpy.mockRestore();
	});

	it('opens text menu for editable inside ignore-context', () => {
		const { result } = renderHook(() =>
			useEnhancedWindowTextContextMenu('win-edit')
		);
		const zone = document.createElement('div');
		zone.setAttribute('data-desktop-window-ignore-context', '');
		const textarea = document.createElement('textarea');
		zone.appendChild(textarea);
		document.body.appendChild(zone);

		const event = makeReactContextMenuEvent(textarea);
		act(() => {
			result.current.onBodyContextMenu(event);
		});

		expect(event.preventDefault).toHaveBeenCalled();
		expect(result.current.textContextMenu).toMatchObject({
			mode: 'paste',
			x: 40,
			y: 60,
		});
	});
});
