/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for floating menu dismiss hook (Escape capture + initial focus).
 *
 * Related:
 * - hooks/useDismissibleFloatingMenu.ts
 */

import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDismissibleFloatingMenu } from '../useDismissibleFloatingMenu';

function mountMenu(): {
	menuRef: RefObject<HTMLDivElement>;
	firstItem: HTMLButtonElement;
	onClose: () => void;
} {
	const menu = document.createElement('div');
	const firstItem = document.createElement('button');
	firstItem.type = 'button';
	firstItem.role = 'menuitem';
	firstItem.textContent = 'Open';
	menu.appendChild(firstItem);
	document.body.appendChild(menu);
	const menuRef: RefObject<HTMLDivElement> = { current: menu };
	const onClose = vi.fn<() => void>();
	return { menuRef, firstItem, onClose };
}

describe('useDismissibleFloatingMenu', () => {
	it('closes on Escape with capture and stopPropagation', () => {
		const { menuRef, onClose } = mountMenu();
		const outer = vi.fn();
		window.addEventListener('keydown', outer);

		renderHook(() =>
			useDismissibleFloatingMenu({
				isOpen: true,
				menuRef,
				onClose,
				escapeCapture: true,
			})
		);

		act(() => {
			document.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					cancelable: true,
				})
			);
		});

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(outer).not.toHaveBeenCalled();

		window.removeEventListener('keydown', outer);
		menuRef.current?.remove();
	});

	it('focuses first menuitem when enabled', async () => {
		const { menuRef, firstItem, onClose } = mountMenu();

		renderHook(() =>
			useDismissibleFloatingMenu({
				isOpen: true,
				menuRef,
				onClose,
				focusFirstMenuItem: true,
			})
		);

		await act(async () => {
			await new Promise<void>((resolve) => {
				window.requestAnimationFrame(() => resolve());
			});
		});

		expect(firstItem).toHaveFocus();
		menuRef.current?.remove();
	});
});
