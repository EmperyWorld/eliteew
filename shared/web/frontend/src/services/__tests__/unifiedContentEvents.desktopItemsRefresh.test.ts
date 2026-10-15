/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for desktop items refresh broadcast after CM folder mutations.
 *
 * Related:
 * - src/services/unifiedContentEvents.ts
 */

import { describe, expect, it, vi } from 'vitest';

import {
	DESKTOP_ITEMS_REFRESH_EVENT,
	requestDesktopItemsRefresh,
} from '@/services/unifiedContentEvents';

describe('requestDesktopItemsRefresh', () => {
	it('dispatches eliteew-desktop-items-refresh on window', () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_ITEMS_REFRESH_EVENT, spy);
		requestDesktopItemsRefresh();
		window.removeEventListener(DESKTOP_ITEMS_REFRESH_EVENT, spy);
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('includes removedItemIds so desktop can drop stale rows before PUT', () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_ITEMS_REFRESH_EVENT, spy);
		requestDesktopItemsRefresh({ removedItemIds: ['folder-1', 'folder-2'] });
		window.removeEventListener(DESKTOP_ITEMS_REFRESH_EVENT, spy);
		expect(spy).toHaveBeenCalledTimes(1);
		const event = spy.mock.calls[0]?.[0] as CustomEvent<{
			removedItemIds?: string[];
		}>;
		expect(event.detail?.removedItemIds).toEqual(['folder-1', 'folder-2']);
	});
});
