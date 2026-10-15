/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for desktop ПКМ policy helper and window chrome action registry.
 *
 * Invariants:
 * - Editable targets allow native; non-editable are suppressed.
 * - Shared window chrome action IDs stay stable for taskbar/workspace parity.
 *
 * Related:
 * - desktopContextMenuPolicy.ts
 * - desktopWindowChromeActions.ts
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */
import type { MouseEvent as ReactMouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
	applyDesktopContextMenuPolicy,
	shouldOpenDesktopCustomContextMenu,
} from '../desktopContextMenuPolicy';
import {
	DESKTOP_WINDOW_CHROME_SHARED_ACTIONS,
	isDesktopWindowChromeSharedAction,
} from '../desktopWindowChromeActions';

function makeEvent(target: EventTarget | null) {
	return {
		target,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	} as unknown as Event;
}

describe('applyDesktopContextMenuPolicy', () => {
	it('allows native menu on textarea', () => {
		const textarea = document.createElement('textarea');
		document.body.appendChild(textarea);
		const event = makeEvent(textarea);
		expect(applyDesktopContextMenuPolicy(event)).toBe('allow-native');
		expect(event.preventDefault).not.toHaveBeenCalled();
		textarea.remove();
	});

	it('suppresses native menu on non-editable chrome', () => {
		const div = document.createElement('div');
		document.body.appendChild(div);
		const event = makeEvent(div);
		expect(applyDesktopContextMenuPolicy(event)).toBe('suppressed');
		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(event.stopPropagation).toHaveBeenCalledOnce();
		div.remove();
	});

	it('shouldOpenDesktopCustomContextMenu mirrors suppress path', () => {
		const button = document.createElement('button');
		document.body.appendChild(button);
		const event = {
			target: button,
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as ReactMouseEvent;
		expect(shouldOpenDesktopCustomContextMenu(event)).toBe(true);
		button.remove();
	});
});

describe('desktopWindowChromeActions', () => {
	it('exposes stable shared action ids for taskbar/workspace parity', () => {
		expect(DESKTOP_WINDOW_CHROME_SHARED_ACTIONS).toEqual([
			'restore-or-focus',
			'minimize',
			'maximize-or-restore',
			'close',
			'move-to-desktop',
		]);
		expect(isDesktopWindowChromeSharedAction('minimize')).toBe(true);
		expect(isDesktopWindowChromeSharedAction('snap')).toBe(false);
	});
});
