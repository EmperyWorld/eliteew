/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	readAdminSectionFromUrl,
	syncAdminShellSectionToUrl,
} from '../shell/adminShellUrl';

describe('readAdminSectionFromUrl', () => {
	it('parses known section from search string', () => {
		expect(readAdminSectionFromUrl('?section=system&foo=1')).toBe('system');
	});

	it('maps legacy system+aiChatTab deep link to desktopAiChat section', () => {
		expect(readAdminSectionFromUrl('?section=system&aiChatTab=blueprint')).toBe(
			'desktopAiChat'
		);
	});

	it('maps legacy section=ugs deep link to ugsV2 section', () => {
		expect(readAdminSectionFromUrl('?section=ugs')).toBe('ugsV2');
	});

	it('returns null for unknown section', () => {
		expect(readAdminSectionFromUrl('?section=unknown')).toBeNull();
	});
});

function mockWindowLocation(href: string): void {
	const url = new URL(href);
	Object.defineProperty(window, 'location', {
		value: {
			href: url.href,
			pathname: url.pathname,
			search: url.search,
			hash: url.hash,
		},
		writable: true,
		configurable: true,
	});
}

describe('syncAdminShellSectionToUrl', () => {
	it('sets section and strips users filters when leaving users', () => {
		const replaceState = vi.fn();
		mockWindowLocation(
			'https://app.test/admin?section=users&q=abc&userId=u1&other=1'
		);
		window.history.replaceState = replaceState;

		syncAdminShellSectionToUrl('desktop');

		const url = replaceState.mock.calls[0]?.[2] as string;
		expect(url).toContain('section=desktop');
		expect(url).not.toContain('q=abc');
		expect(url).not.toContain('userId=');
		expect(url).toContain('other=1');
	});

	it('strips feedback ticket when leaving feedback section', () => {
		const replaceState = vi.fn();
		mockWindowLocation(
			'https://app.test/admin?section=feedback&ticket=abc-123'
		);
		window.history.replaceState = replaceState;

		syncAdminShellSectionToUrl('users');

		const url = replaceState.mock.calls[0]?.[2] as string;
		expect(url).toContain('section=users');
		expect(url).not.toContain('ticket=');
	});

	it('strips aiChatTab when leaving desktopAiChat section', () => {
		const replaceState = vi.fn();
		mockWindowLocation(
			'https://app.test/admin?section=desktopAiChat&aiChatTab=defaults'
		);
		window.history.replaceState = replaceState;

		syncAdminShellSectionToUrl('system');

		const url = replaceState.mock.calls[0]?.[2] as string;
		expect(url).toContain('section=system');
		expect(url).not.toContain('aiChatTab=');
	});

	it('keeps users filters when syncing users section', () => {
		const replaceState = vi.fn();
		mockWindowLocation('https://app.test/admin?q=abc');
		window.history.replaceState = replaceState;

		syncAdminShellSectionToUrl('users');

		const url = replaceState.mock.calls[0]?.[2] as string;
		expect(url).toContain('q=abc');
		expect(url).toContain('section=users');
	});
});
