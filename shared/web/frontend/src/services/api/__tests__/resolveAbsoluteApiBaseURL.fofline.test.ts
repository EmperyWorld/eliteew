/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock FoFline opaque-origin absolute API base rewrite for relative `/api/v1`
 * Axios overrides and streaming `apiFetchWithAuth` (desktop hydrate must reach stack0).
 *
 * Related:
 * - `services/api/config.ts`, `services/api/client.ts`
 * - `documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md` §5 / L3
 */

import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../authSession', () => ({
	default: {
		authenticated: true,
		token: 'test-access-token',
		tokenParsed: { exp: Math.floor(Date.now() / 1000) + 3600 },
		updateToken: vi.fn().mockResolvedValue(true),
		login: vi.fn(),
		logout: vi.fn(),
	},
	notifySessionReplaced: vi.fn(),
}));

function stubFoflineSpaLocation(): void {
	const location = {
		protocol: 'fofline-spa:',
		origin: 'null',
		hostname: 'localhost',
		href: 'fofline-spa://localhost/index.html?eliteewFoflineClient=1',
	};
	// Keep real `window` (localStorage / listeners); only swap location for opaque origin.
	vi.stubGlobal('location', location);
	Object.defineProperty(window, 'location', {
		configurable: true,
		writable: true,
		value: location,
	});
	Object.defineProperty(window, '__TAURI__', {
		configurable: true,
		writable: true,
		value: undefined,
	});
}

describe('resolveAbsoluteApiBaseURL (FoFline / Tauri)', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it('absolutizes relative /api/v1 on fofline-spa protocol', async () => {
		stubFoflineSpaLocation();
		const { resolveAbsoluteApiBaseURL } = await import('../config');
		expect(resolveAbsoluteApiBaseURL('/api/v1')).toBe(
			'https://app.eliteew.ru/api/v1'
		);
		expect(resolveAbsoluteApiBaseURL('/api/v1/desktop')).toBe(
			'https://app.eliteew.ru/api/v1/desktop'
		);
	});

	it('keeps absolute https base unchanged', async () => {
		vi.stubGlobal('location', {
			protocol: 'https:',
			origin: 'https://app.eliteew.ru',
			hostname: 'app.eliteew.ru',
			href: 'https://app.eliteew.ru/',
		});
		vi.stubGlobal('window', {
			location: {
				protocol: 'https:',
				origin: 'https://app.eliteew.ru',
				hostname: 'app.eliteew.ru',
			},
		});
		const { resolveAbsoluteApiBaseURL } = await import('../config');
		expect(resolveAbsoluteApiBaseURL('https://app.eliteew.ru/api/v1')).toBe(
			'https://app.eliteew.ru/api/v1'
		);
	});

	it('request interceptor absolutizes per-request baseURL on fofline-spa', async () => {
		stubFoflineSpaLocation();
		vi.resetModules();
		const seen: { baseURL?: string } = {};
		const adapter: AxiosAdapter = async (config) => {
			seen.baseURL =
				typeof config.baseURL === 'string' ? config.baseURL : undefined;
			return {
				data: {},
				status: 200,
				statusText: 'OK',
				headers: {},
				config: config as InternalAxiosRequestConfig,
			};
		};
		const { createAPIClient } = await import('../client');
		const client = createAPIClient({ adapter, baseURL: '' });
		await client.get('/desktop/shell-bootstrap', { baseURL: '/api/v1' });
		expect(seen.baseURL).toBe('https://app.eliteew.ru/api/v1');
	});

	it('apiFetchWithAuth absolutizes relative /api path on fofline-spa', async () => {
		stubFoflineSpaLocation();
		vi.resetModules();
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('{}', { status: 200 }));
		const { apiFetchWithAuth } = await import('../client');
		await apiFetchWithAuth('/api/v1/desktop/shell-bootstrap', {
			method: 'GET',
		});
		expect(fetchSpy).toHaveBeenCalledWith(
			'https://app.eliteew.ru/api/v1/desktop/shell-bootstrap',
			expect.objectContaining({ method: 'GET' })
		);
	});
});
