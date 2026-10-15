/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock quiet-chrome default: unset localStorage → header collapsed (settings hidden).
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
	HEADER_COLLAPSED_KEY,
	readHeaderCollapsed,
} from '../utils/desktopAiChatFormatters';

describe('readHeaderCollapsed premium default', () => {
	afterEach(() => {
		localStorage.removeItem(HEADER_COLLAPSED_KEY);
	});

	it('defaults to collapsed when key is missing', () => {
		localStorage.removeItem(HEADER_COLLAPSED_KEY);
		expect(readHeaderCollapsed()).toBe(true);
	});

	it('honours explicit expanded stored as 0', () => {
		localStorage.setItem(HEADER_COLLAPSED_KEY, '0');
		expect(readHeaderCollapsed()).toBe(false);
	});

	it('honours explicit collapsed stored as 1', () => {
		localStorage.setItem(HEADER_COLLAPSED_KEY, '1');
		expect(readHeaderCollapsed()).toBe(true);
	});
});
