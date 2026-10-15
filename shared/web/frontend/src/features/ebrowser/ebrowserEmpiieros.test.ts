/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock EmpiierOS Seat Browser open/close without Tauri invoke.
 *
 * Related:
 * - features/ebrowser/ebrowserEmpiieros.ts
 * - features/ebrowser/ebrowserNative.ts
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/keycloakProfile', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('@/services/keycloakProfile')>();
	return {
		...actual,
		getOidcRuntimeProfile: vi.fn(() => 'web' as const),
	};
});

import { getOidcRuntimeProfile } from '@/services/keycloakProfile';
import { openNativeEBrowser } from './ebrowserNative';
import {
	closeEmpiierosSeatBrowser,
	ebrowserDownloadsOpenTarget,
	openEmpiierosSeatBrowser,
} from './ebrowserEmpiieros';

type SeatHost = {
	openSeatBrowser: (args: Record<string, unknown>) => Promise<{ ok: boolean }>;
	closeSeatBrowser?: () => Promise<{ ok: boolean }>;
};

function installEmpiierosOidc(): void {
	vi.mocked(getOidcRuntimeProfile).mockReturnValue('foflineNative');
	(
		window as Window & {
			EmperyDesktopNativeOidc?: { refreshSessionJson: () => string };
		}
	).EmperyDesktopNativeOidc = {
		refreshSessionJson: () => '{}',
	};
}

describe('ebrowserEmpiieros', () => {
	afterEach(() => {
		vi.mocked(getOidcRuntimeProfile).mockReturnValue('web');
		delete (window as Window & { __TAURI_INTERNALS__?: unknown })
			.__TAURI_INTERNALS__;
		delete (window as Window & { EmperyDesktopNativeOidc?: unknown })
			.EmperyDesktopNativeOidc;
		delete (window as Window & { EmperyDesktopSeatBrowser?: unknown })
			.EmperyDesktopSeatBrowser;
	});

	it('opens https on the seat host and does not invoke ebrowser_open', async () => {
		installEmpiierosOidc();
		const invoke = vi.fn();
		const openSeatBrowser = vi.fn(async () => ({ ok: true }));
		(
			window as Window & { EmperyDesktopSeatBrowser?: SeatHost }
		).EmperyDesktopSeatBrowser = { openSeatBrowser };
		const { isEmpiierosFoflineHost } = await import(
			'@/services/desktopClient/eliteewProductHost'
		);
		expect(isEmpiierosFoflineHost()).toBe(true);
		expect(
			await openEmpiierosSeatBrowser({ url: 'https://app.eliteew.ru/' })
		).toEqual({ ok: true });
		expect(openSeatBrowser).toHaveBeenCalledWith({
			url: 'https://app.eliteew.ru/',
		});
		const sent = openSeatBrowser.mock.calls[0]?.[0] ?? {};
		expect(sent).not.toHaveProperty('accessToken');
		expect(sent).not.toHaveProperty('refresh');
		expect(JSON.stringify(sent)).not.toMatch(/cookie/i);
		expect(invoke).not.toHaveBeenCalled();
		expect(
			await openNativeEBrowser('https://app.eliteew.ru/', {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			})
		).toEqual({ ok: false, code: 'not_native' });
	});

	it('still calls ebrowser_open when Tauri invoke exists', async () => {
		vi.mocked(getOidcRuntimeProfile).mockReturnValue('foflineNative');
		const invoke = vi.fn(async () => ({ ok: true }));
		(
			window as Window & {
				__TAURI_INTERNALS__?: { invoke: typeof invoke };
			}
		).__TAURI_INTERNALS__ = { invoke };
		const bounds = { x: 1, y: 2, width: 300, height: 200 };
		expect(await openNativeEBrowser('https://app.eliteew.ru/', bounds)).toEqual(
			{
				ok: true,
			}
		);
		expect(invoke).toHaveBeenCalledWith(
			'ebrowser_open',
			expect.objectContaining({
				navHref: 'https://app.eliteew.ru/',
				bounds,
			})
		);
	});

	it('returns seat_browser_unavailable when the host object is missing', async () => {
		installEmpiierosOidc();
		expect(
			await openEmpiierosSeatBrowser({ url: 'https://app.eliteew.ru/' })
		).toEqual({ ok: false, code: 'seat_browser_unavailable' });
		expect(await closeEmpiierosSeatBrowser()).toEqual({
			ok: false,
			code: 'seat_browser_unavailable',
		});
	});

	it('does not send http or file urls to the host', async () => {
		const openSeatBrowser = vi.fn(async () => ({ ok: true }));
		(
			window as Window & { EmperyDesktopSeatBrowser?: SeatHost }
		).EmperyDesktopSeatBrowser = { openSeatBrowser };
		expect(
			await openEmpiierosSeatBrowser({ url: 'http://app.eliteew.ru/' })
		).toEqual({ ok: false, code: 'seat_browser_scheme' });
		expect(
			await openEmpiierosSeatBrowser({ url: 'file:///tmp/page.html' })
		).toEqual({ ok: false, code: 'seat_browser_scheme' });
		expect(
			await openEmpiierosSeatBrowser({
				url: 'fofline-spa://localhost/index.html',
			})
		).toEqual({ ok: false, code: 'seat_browser_scheme' });
		expect(
			await openEmpiierosSeatBrowser({ url: 'blob:fofline-spa:abc' })
		).toEqual({
			ok: false,
			code: 'seat_browser_scheme',
		});
		expect(openSeatBrowser).not.toHaveBeenCalled();
	});

	it('does not open an OS folder for EmpiierOS downloads', () => {
		expect(ebrowserDownloadsOpenTarget('empiieros')).toBe('seat_local_notice');
		expect(ebrowserDownloadsOpenTarget('empiieros')).not.toBe(
			'content_manager'
		);
		expect(ebrowserDownloadsOpenTarget('tauri')).toBe('content_manager');
	});
});
