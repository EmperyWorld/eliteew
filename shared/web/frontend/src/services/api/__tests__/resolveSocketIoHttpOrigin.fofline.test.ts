/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Socket.IO HTTP origin on opaque FoFline vs browser vs non-opaque hosts.
 *
 * Related:
 * - ../config.ts
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

function stubLocation(location: {
	protocol: string;
	origin: string;
	hostname: string;
	href: string;
}): void {
	vi.stubGlobal('location', location);
	Object.defineProperty(window, 'location', {
		configurable: true,
		writable: true,
		value: location,
	});
}

describe('resolveSocketIoHttpOrigin', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it('maps fofline-spa://localhost to https://app.eliteew.ru', async () => {
		stubLocation({
			protocol: 'fofline-spa:',
			origin: 'null',
			hostname: 'localhost',
			href: 'fofline-spa://localhost/index.html',
		});
		const { resolveSocketIoHttpOrigin, FOFLINE_SOCKET_IO_HTTP_ORIGIN } =
			await import('../config');
		expect(resolveSocketIoHttpOrigin()).toBe(FOFLINE_SOCKET_IO_HTTP_ORIGIN);
		expect(resolveSocketIoHttpOrigin()).toBe('https://app.eliteew.ru');
	});

	it('keeps browser https://app.eliteew.ru', async () => {
		stubLocation({
			protocol: 'https:',
			origin: 'https://app.eliteew.ru',
			hostname: 'app.eliteew.ru',
			href: 'https://app.eliteew.ru/',
		});
		const { resolveSocketIoHttpOrigin } = await import('../config');
		expect(resolveSocketIoHttpOrigin()).toBe('https://app.eliteew.ru');
	});

	it('keeps non-opaque Tauri/dev fallback (env or location.origin)', async () => {
		stubLocation({
			protocol: 'tauri:',
			origin: 'tauri://localhost',
			hostname: 'localhost',
			href: 'tauri://localhost/',
		});
		const { resolveSocketIoHttpOrigin } = await import('../config');
		const expected =
			(import.meta.env.VITE_WS_ORIGIN as string | undefined)?.trim() ||
			(import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim() ||
			'tauri://localhost';
		expect(resolveSocketIoHttpOrigin()).toBe(expected);
	});
});
