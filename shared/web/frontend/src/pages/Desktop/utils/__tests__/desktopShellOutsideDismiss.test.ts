/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Start menu / pinned modal outside-click guard contracts.
 */
import { describe, expect, it } from 'vitest';
import {
	shouldClearDesktopIconSelectionOnKeyDown,
	shouldClearDesktopIconSelectionOnPointerDown,
	shouldCloseClockMenuOnOutsidePointer,
	shouldCloseNotificationCenterOnOutsidePointer,
	shouldCloseStartMenuOnOutsidePointer,
	shouldCloseTrayOnOutsidePointer,
	shouldCloseTaskbarPopoverOnOutsidePointer,
	shouldCloseVolumeMenuOnOutsidePointer,
	shouldDismissPinnedMenuBackdrop,
} from '@/pages/Desktop/utils/desktopShellOutsideDismiss';

function el(tag = 'div', attrs: Record<string, string> = {}): HTMLElement {
	const node = document.createElement(tag);
	for (const [key, value] of Object.entries(attrs)) {
		node.setAttribute(key, value);
	}
	document.body.appendChild(node);
	return node;
}

describe('shouldCloseStartMenuOnOutsidePointer', () => {
	it('does not close while open-click guard is active', () => {
		const outside = el('button');
		const panel = el('div', { id: 'start-menu-panel' });
		expect(
			shouldCloseStartMenuOnOutsidePointer({
				openClickGuardActive: true,
				target: outside,
				panelRoot: panel,
				appContextMenuRoot: null,
			})
		).toBe(false);
		outside.remove();
		panel.remove();
	});

	it('ignores clicks on Start toggle and app context menu', () => {
		const panel = el('div', { id: 'start-menu-panel' });
		const toggle = el('button', { 'data-start-menu-toggle': 'true' });
		const appMenu = el('div');
		const appMenuItem = el('button');
		appMenu.appendChild(appMenuItem);

		expect(
			shouldCloseStartMenuOnOutsidePointer({
				openClickGuardActive: false,
				target: toggle,
				panelRoot: panel,
				appContextMenuRoot: appMenu,
			})
		).toBe(false);

		expect(
			shouldCloseStartMenuOnOutsidePointer({
				openClickGuardActive: false,
				target: appMenuItem,
				panelRoot: panel,
				appContextMenuRoot: appMenu,
			})
		).toBe(false);

		panel.remove();
		toggle.remove();
		appMenu.remove();
	});

	it('closes on outside desktop click when guard is inactive', () => {
		const panel = el('div', { id: 'start-menu-panel' });
		const outside = el('main');
		expect(
			shouldCloseStartMenuOnOutsidePointer({
				openClickGuardActive: false,
				target: outside,
				panelRoot: panel,
				appContextMenuRoot: null,
			})
		).toBe(true);
		panel.remove();
		outside.remove();
	});

	it('does not close for clicks inside the Start panel', () => {
		const panel = el('div', { id: 'start-menu-panel' });
		const inside = el('button');
		panel.appendChild(inside);
		expect(
			shouldCloseStartMenuOnOutsidePointer({
				openClickGuardActive: false,
				target: inside,
				panelRoot: panel,
				appContextMenuRoot: null,
			})
		).toBe(false);
		panel.remove();
	});
});

describe('shouldDismissPinnedMenuBackdrop', () => {
	it('blocks backdrop close while open guard is active', () => {
		expect(shouldDismissPinnedMenuBackdrop(true)).toBe(false);
	});

	it('allows backdrop close after guard expires', () => {
		expect(shouldDismissPinnedMenuBackdrop(false)).toBe(true);
	});
});

describe('shouldCloseNotificationCenterOnOutsidePointer', () => {
	it('does not close while open-click guard is active', () => {
		const outside = el('main');
		const panel = el('div', { id: 'notification-center-panel' });
		expect(
			shouldCloseNotificationCenterOnOutsidePointer({
				openClickGuardActive: true,
				target: outside,
				panelRoot: panel,
			})
		).toBe(false);
		outside.remove();
		panel.remove();
	});

	it('ignores clicks on notification bell toggle', () => {
		const panel = el('div', { id: 'notification-center-panel' });
		const toggle = el('button', { 'data-notification-toggle': 'true' });
		expect(
			shouldCloseNotificationCenterOnOutsidePointer({
				openClickGuardActive: false,
				target: toggle,
				panelRoot: panel,
			})
		).toBe(false);
		panel.remove();
		toggle.remove();
	});

	it('closes on outside click when guard is inactive', () => {
		const panel = el('div', { id: 'notification-center-panel' });
		const outside = el('main');
		expect(
			shouldCloseNotificationCenterOnOutsidePointer({
				openClickGuardActive: false,
				target: outside,
				panelRoot: panel,
			})
		).toBe(true);
		panel.remove();
		outside.remove();
	});
});

describe('shouldCloseTrayOnOutsidePointer', () => {
	it('does not close while open-click guard is active', () => {
		const outside = el('main');
		const toggleRoot = el('div');
		expect(
			shouldCloseTrayOnOutsidePointer({
				openClickGuardActive: true,
				target: outside,
				trayToggleRoot: toggleRoot,
			})
		).toBe(false);
		outside.remove();
		toggleRoot.remove();
	});

	it('ignores tray toggle, toggle root, and tray popup', () => {
		const toggleRoot = el('div');
		const toggle = el('button', { 'data-tray-toggle': 'true' });
		toggleRoot.appendChild(toggle);
		const popup = el('div', { 'data-tray-popup': 'true' });
		const popupItem = el('button');
		popup.appendChild(popupItem);

		expect(
			shouldCloseTrayOnOutsidePointer({
				openClickGuardActive: false,
				target: toggle,
				trayToggleRoot: toggleRoot,
			})
		).toBe(false);

		expect(
			shouldCloseTrayOnOutsidePointer({
				openClickGuardActive: false,
				target: popupItem,
				trayToggleRoot: toggleRoot,
			})
		).toBe(false);

		toggleRoot.remove();
		popup.remove();
	});

	it('closes on desktop click when guard is inactive', () => {
		const toggleRoot = el('div');
		const outside = el('main');
		expect(
			shouldCloseTrayOnOutsidePointer({
				openClickGuardActive: false,
				target: outside,
				trayToggleRoot: toggleRoot,
			})
		).toBe(true);
		toggleRoot.remove();
		outside.remove();
	});
});

describe('shouldCloseTaskbarPopoverOnOutsidePointer', () => {
	it('delegates generic toggle and nested menu rules', () => {
		const panel = el('div');
		const toggle = el('button', { 'data-custom-toggle': 'true' });
		const nested = el('div');
		const nestedItem = el('button');
		nested.appendChild(nestedItem);

		expect(
			shouldCloseTaskbarPopoverOnOutsidePointer({
				openClickGuardActive: false,
				target: toggle,
				panelRoot: panel,
				toggleSelector: '[data-custom-toggle]',
				nestedMenuRoot: nested,
			})
		).toBe(false);

		expect(
			shouldCloseTaskbarPopoverOnOutsidePointer({
				openClickGuardActive: false,
				target: nestedItem,
				panelRoot: panel,
				toggleSelector: '[data-custom-toggle]',
				nestedMenuRoot: nested,
			})
		).toBe(false);

		panel.remove();
		toggle.remove();
		nested.remove();
	});
});

describe('shouldCloseClockMenuOnOutsidePointer', () => {
	it('respects open guard and clock toggle', () => {
		const panel = el('div');
		const toggle = el('button', { 'data-clock-toggle': 'true' });
		const outside = el('main');

		expect(
			shouldCloseClockMenuOnOutsidePointer({
				openClickGuardActive: true,
				target: outside,
				panelRoot: panel,
			})
		).toBe(false);

		expect(
			shouldCloseClockMenuOnOutsidePointer({
				openClickGuardActive: false,
				target: toggle,
				panelRoot: panel,
			})
		).toBe(false);

		expect(
			shouldCloseClockMenuOnOutsidePointer({
				openClickGuardActive: false,
				target: outside,
				panelRoot: panel,
			})
		).toBe(true);

		panel.remove();
		toggle.remove();
		outside.remove();
	});
});

describe('shouldCloseVolumeMenuOnOutsidePointer', () => {
	it('respects open guard and volume popup chrome', () => {
		const popup = el('div', { 'data-volume-mini-popup': 'true' });
		const popupItem = el('button');
		popup.appendChild(popupItem);
		const outside = el('main');

		expect(
			shouldCloseVolumeMenuOnOutsidePointer({
				openClickGuardActive: true,
				target: outside,
			})
		).toBe(false);

		expect(
			shouldCloseVolumeMenuOnOutsidePointer({
				openClickGuardActive: false,
				target: popupItem,
			})
		).toBe(false);

		expect(
			shouldCloseVolumeMenuOnOutsidePointer({
				openClickGuardActive: false,
				target: outside,
			})
		).toBe(true);

		popup.remove();
		outside.remove();
	});
});

describe('shouldClearDesktopIconSelectionOnPointerDown', () => {
	it('keeps selection for icon, rail, and context menu targets', () => {
		const icon = el('div', { 'data-desktop-icon': 'true' });
		const rail = el('div', { 'data-assistant-selection-rail': 'true' });
		const menu = el('div', { 'data-desktop-enhanced-context-menu': 'true' });
		const menuItem = el('button');
		menu.appendChild(menuItem);

		expect(shouldClearDesktopIconSelectionOnPointerDown({ target: icon })).toBe(
			false
		);
		expect(shouldClearDesktopIconSelectionOnPointerDown({ target: rail })).toBe(
			false
		);
		expect(
			shouldClearDesktopIconSelectionOnPointerDown({ target: menuItem })
		).toBe(false);

		icon.remove();
		rail.remove();
		menu.remove();
	});

	it('clears selection for taskbar, windows, and desktop chrome', () => {
		const taskbar = el('div', { 'data-desktop-taskbar-strip': 'true' });
		const windowRoot = el('div', { 'data-desktop-window': 'true' });
		const background = el('button', { 'data-desktop-background': 'true' });

		expect(
			shouldClearDesktopIconSelectionOnPointerDown({ target: taskbar })
		).toBe(true);
		expect(
			shouldClearDesktopIconSelectionOnPointerDown({ target: windowRoot })
		).toBe(true);
		expect(
			shouldClearDesktopIconSelectionOnPointerDown({ target: background })
		).toBe(true);

		taskbar.remove();
		windowRoot.remove();
		background.remove();
	});
});

describe('shouldClearDesktopIconSelectionOnKeyDown', () => {
	it('clears when focus moved into a window field', () => {
		expect(
			shouldClearDesktopIconSelectionOnKeyDown({
				event: { key: 'a', ctrlKey: false, metaKey: false, target: null },
				renamingId: null,
				deferToFocusedSurface: true,
			})
		).toBe(true);
	});

	it('preserves icon navigation and clipboard shortcuts', () => {
		const icon = el('div', { 'data-desktop-icon': 'true' });
		const iconButton = el('button');
		icon.appendChild(iconButton);

		expect(
			shouldClearDesktopIconSelectionOnKeyDown({
				event: {
					key: 'ArrowRight',
					ctrlKey: false,
					metaKey: false,
					target: iconButton,
				},
				renamingId: null,
				deferToFocusedSurface: false,
			})
		).toBe(false);

		expect(
			shouldClearDesktopIconSelectionOnKeyDown({
				event: {
					key: 'c',
					ctrlKey: true,
					metaKey: false,
					target: iconButton,
				},
				renamingId: null,
				deferToFocusedSurface: false,
			})
		).toBe(false);

		expect(
			shouldClearDesktopIconSelectionOnKeyDown({
				event: {
					key: 'a',
					ctrlKey: false,
					metaKey: false,
					target: iconButton,
				},
				renamingId: null,
				deferToFocusedSurface: false,
			})
		).toBe(true);

		icon.remove();
	});

	it('does not clear during rename or on Escape', () => {
		expect(
			shouldClearDesktopIconSelectionOnKeyDown({
				event: { key: 'a', ctrlKey: false, metaKey: false, target: null },
				renamingId: 'icon-1',
				deferToFocusedSurface: false,
			})
		).toBe(false);

		expect(
			shouldClearDesktopIconSelectionOnKeyDown({
				event: { key: 'Escape', ctrlKey: false, metaKey: false, target: null },
				renamingId: null,
				deferToFocusedSurface: false,
			})
		).toBe(false);
	});
});
