import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	getDesktopShortcutHelpGroups,
	useKeyboardShortcuts,
} from '../useKeyboardShortcuts';

function dispatchWindowKey(type: 'keydown' | 'keyup', key: string): void {
	act(() => {
		window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
	});
}

function pressShortcut(modifiers: string[], key: string): void {
	modifiers.forEach((modifier) => {
		dispatchWindowKey('keydown', modifier);
	});
	dispatchWindowKey('keydown', key);
	dispatchWindowKey('keyup', key);
	[...modifiers].reverse().forEach((modifier) => {
		dispatchWindowKey('keyup', modifier);
	});
}

describe('useKeyboardShortcuts', () => {
	afterEach(() => {
		dispatchWindowKey('keyup', 'Meta');
		dispatchWindowKey('keyup', 'Control');
		dispatchWindowKey('keyup', 'Alt');
		dispatchWindowKey('keyup', 'Shift');
	});

	it('maps desktop launcher shortcuts to the expected handlers', () => {
		const handlers = {
			onQuickSearch: vi.fn(),
			onOpenClipboard: vi.fn(),
			onOpenProfile: vi.fn(),
		};

		renderHook(() => useKeyboardShortcuts(handlers));

		pressShortcut(['Meta'], 's');
		pressShortcut(['Meta'], 'v');
		pressShortcut(['Meta'], 'u');

		expect(handlers.onQuickSearch).toHaveBeenCalledTimes(1);
		expect(handlers.onOpenClipboard).toHaveBeenCalledTimes(1);
		expect(handlers.onOpenProfile).toHaveBeenCalledTimes(1);
	});

	it('supports shell creation and system shortcuts without conflicting modifiers', () => {
		const handlers = {
			onNewFolder: vi.fn(),
			onOpenTaskManager: vi.fn(),
		};

		renderHook(() => useKeyboardShortcuts(handlers));

		pressShortcut(['Control', 'Shift'], 'N');
		pressShortcut(['Control', 'Alt'], 'Delete');

		expect(handlers.onNewFolder).toHaveBeenCalledTimes(1);
		expect(handlers.onOpenTaskManager).toHaveBeenCalledTimes(1);
	});

	it('ignores keydown events without a string key (IME / synthetic)', () => {
		const handlers = {
			onHelp: vi.fn(),
			onRefresh: vi.fn(),
		};

		renderHook(() => useKeyboardShortcuts(handlers));

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', { bubbles: true } as KeyboardEventInit)
			);
		});

		expect(handlers.onHelp).not.toHaveBeenCalled();
		expect(handlers.onRefresh).not.toHaveBeenCalled();
	});

	it('Win+D shows desktop and prevents browser default', () => {
		const onShowDesktop = vi.fn();
		renderHook(() => useKeyboardShortcuts({ onShowDesktop }));

		let prevented = false;
		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Meta', bubbles: true })
			);
			const event = new KeyboardEvent('keydown', {
				key: 'd',
				bubbles: true,
				cancelable: true,
			});
			event.preventDefault = () => {
				prevented = true;
			};
			window.dispatchEvent(event);
		});

		expect(onShowDesktop).toHaveBeenCalledTimes(1);
		expect(prevented).toBe(true);
	});

	it('defers shell shortcuts when a text field is focused', () => {
		const onQuickSearch = vi.fn();
		renderHook(() => useKeyboardShortcuts({ onQuickSearch }));

		const input = document.createElement('input');
		input.type = 'text';
		document.body.appendChild(input);
		input.focus();

		pressShortcut(['Meta'], 's');

		expect(onQuickSearch).not.toHaveBeenCalled();
		input.remove();
	});

	it('Win+E prevents browser default when explorer handler is wired', () => {
		const onOpenExplorer = vi.fn();
		renderHook(() => useKeyboardShortcuts({ onOpenExplorer }));

		let prevented = false;
		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Meta', bubbles: true })
			);
			const event = new KeyboardEvent('keydown', {
				key: 'e',
				bubbles: true,
				cancelable: true,
			});
			event.preventDefault = () => {
				prevented = true;
			};
			window.dispatchEvent(event);
		});

		expect(onOpenExplorer).toHaveBeenCalledTimes(1);
		expect(prevented).toBe(true);
	});
});

describe('getDesktopShortcutHelpGroups', () => {
	it('lists only wired shortcuts (no task manager, lock, or window menu)', () => {
		const t = ((key: string) => key) as Parameters<
			typeof getDesktopShortcutHelpGroups
		>[0];
		const groups = getDesktopShortcutHelpGroups(t);
		const ids = groups.flatMap((g) => g.items.map((item) => item.id));

		expect(ids).toContain('shortcuts.shell.notifications');
		expect(ids).toContain('shortcuts.windows.snapBottom');
		expect(ids).toContain('shortcuts.system.fullscreen');
		expect(ids).not.toContain('shortcuts.system.taskMgr');
		expect(ids).not.toContain('shortcuts.system.lock');
		expect(ids).not.toContain('shortcuts.windows.windowMenu');
	});
});
