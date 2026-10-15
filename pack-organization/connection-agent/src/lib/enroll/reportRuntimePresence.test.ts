/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for runtime presence report payload shape.
 */

import { describe, expect, it, vi } from 'vitest';
import {
	detectBuildChannel,
	reportRuntimePresence,
} from './reportRuntimePresence';

describe('reportRuntimePresence', () => {
	it('posts license+device heartbeat body', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ ok: true }),
		});
		vi.stubGlobal('fetch', fetchMock);
		const res = await reportRuntimePresence({
			enrollBase: 'https://app.eliteew.ru/',
			payload: {
				licenseId: '11111111-1111-1111-1111-111111111111',
				deviceId: '22222222-2222-2222-2222-222222222222',
				appVersion: '0.4.4',
				wgUp: true,
				buildChannel: 'rpm',
				updaterPubkeyBaked: false,
			},
		});
		expect(res).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledWith(
			'https://app.eliteew.ru/api/v1/desktop-client/runtime/presence',
			expect.objectContaining({
				method: 'POST',
			})
		);
		const body = JSON.parse(
			(fetchMock.mock.calls[0]?.[1] as { body: string }).body
		) as { integrity: { authenticode: boolean }; wg_up: boolean };
		expect(body.wg_up).toBe(true);
		expect(body.integrity.authenticode).toBe(false);
		vi.unstubAllGlobals();
	});

	it('detectBuildChannel returns known enum', () => {
		expect(['rpm', 'nsis', 'unknown']).toContain(detectBuildChannel());
	});
});
