/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Floating-widget ПКМ: suppress native always; open chrome menu only off buttons.
 *
 * Invariants:
 * - Interactive targets: policy suppress, no custom menu open.
 * - Chrome targets: policy suppress + shouldOpen true.
 *
 * Related:
 * - helpers.ts
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */
import { describe, expect, it, vi } from 'vitest';
import {
	isFwContextMenuBlockedTarget,
	shouldOpenFloatingWidgetContextMenu,
} from '../helpers';

function makeEvent(target: EventTarget | null) {
	return {
		target,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	} as unknown as Event;
}

describe('floating widget context menu helpers', () => {
	it('blocks interactive targets for custom menu', () => {
		const button = document.createElement('button');
		document.body.appendChild(button);
		expect(isFwContextMenuBlockedTarget(button)).toBe(true);
		const event = makeEvent(button);
		expect(shouldOpenFloatingWidgetContextMenu(event)).toBe(false);
		expect(event.preventDefault).toHaveBeenCalledOnce();
		button.remove();
	});

	it('opens custom menu on chrome after suppress', () => {
		const chrome = document.createElement('div');
		document.body.appendChild(chrome);
		expect(isFwContextMenuBlockedTarget(chrome)).toBe(false);
		const event = makeEvent(chrome);
		expect(shouldOpenFloatingWidgetContextMenu(event)).toBe(true);
		expect(event.preventDefault).toHaveBeenCalledOnce();
		chrome.remove();
	});
});
