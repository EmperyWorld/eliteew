/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it, vi } from 'vitest';
import {
	isDesktopAiChatAdminTab,
	migrateLegacyDesktopAiChatAdminShellUrl,
	readDesktopAiChatAdminTabFromUrl,
} from '../desktopAiChatAdminUrl';

describe('desktopAiChatAdminUrl', () => {
	it('reads aiChatTab when section=desktopAiChat', () => {
		expect(
			readDesktopAiChatAdminTabFromUrl(
				'?section=desktopAiChat&aiChatTab=defaults'
			)
		).toBe('defaults');
		expect(
			readDesktopAiChatAdminTabFromUrl(
				'?section=desktopAiChat&aiChatTab=blueprint'
			)
		).toBe('blueprint');
		expect(
			readDesktopAiChatAdminTabFromUrl('?section=search&aiChatTab=defaults')
		).toBe(null);
	});

	it('reads aiChatTab from legacy section=system deep links', () => {
		expect(
			readDesktopAiChatAdminTabFromUrl('?section=system&aiChatTab=defaults')
		).toBe('defaults');
		expect(
			readDesktopAiChatAdminTabFromUrl('?section=system&aiChatTab=blueprint')
		).toBe('blueprint');
	});

	it('validates tab ids', () => {
		expect(isDesktopAiChatAdminTab('blueprint')).toBe(true);
		expect(isDesktopAiChatAdminTab('diagnostics')).toBe(true);
		expect(isDesktopAiChatAdminTab('nope')).toBe(false);
	});

	it('migrates legacy system deep link to desktopAiChat section', () => {
		const replaceState = vi.fn();
		Object.defineProperty(window, 'location', {
			value: {
				href: 'https://app.test/admin?section=system&aiChatTab=blueprint',
				pathname: '/admin',
				search: '?section=system&aiChatTab=blueprint',
				hash: '',
			},
			writable: true,
			configurable: true,
		});
		window.history.replaceState = replaceState;

		migrateLegacyDesktopAiChatAdminShellUrl({ enabled: true });

		const url = replaceState.mock.calls[0]?.[2] as string;
		expect(url).toContain('section=desktopAiChat');
		expect(url).toContain('aiChatTab=blueprint');
	});
});
