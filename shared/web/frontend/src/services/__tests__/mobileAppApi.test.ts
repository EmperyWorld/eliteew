/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for mobile hub API client cache-bypass on session-scoped GETs.
 *
 * Invariants:
 * - Trusted-device list and overview GETs send no-store headers and a cache-bust query param.
 *
 * Related:
 * - ../mobileAppApi.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn(async () => ({ data: { items: [] } }));

vi.mock('@/services/api/client', () => ({
	apiClient: {
		get: getMock,
		post: vi.fn(),
	},
}));

describe('mobileAppApi session-scoped GETs', () => {
	beforeEach(() => {
		getMock.mockClear();
	});

	it('fetchMobileTrustedDevices bypasses browser cache', async () => {
		const { fetchMobileTrustedDevices } = await import('../mobileAppApi');
		await fetchMobileTrustedDevices();
		expect(getMock).toHaveBeenCalledTimes(1);
		const call = getMock.mock.calls[0];
		expect(call).toBeDefined();
		const [url, config] = call as unknown as [
			string,
			{
				params: { _: number };
				headers: Record<string, string>;
			},
		];
		expect(url).toBe('/api/v1/mobile-devices');
		expect(typeof config.params._).toBe('number');
		expect(config.headers['Cache-Control']).toContain('no-store');
		expect(config.headers.Pragma).toBe('no-cache');
	});

	it('fetchMobileAppOverview bypasses browser cache', async () => {
		const { fetchMobileAppOverview } = await import('../mobileAppApi');
		await fetchMobileAppOverview();
		expect(getMock).toHaveBeenCalledTimes(1);
		const call = getMock.mock.calls[0];
		expect(call).toBeDefined();
		const [, config] = call as unknown as [
			string,
			{
				params: { _: number };
				headers: Record<string, string>;
			},
		];
		expect(typeof config.params._).toBe('number');
		expect(config.headers['Cache-Control']).toContain('no-store');
	});
});
