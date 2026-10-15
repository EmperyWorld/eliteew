/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * pagehide `/end` must use keepalive fetch with the access token only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/authSession', () => ({
	getToken: vi.fn(() => 'access-token'),
}));

import { getToken } from '@/services/authSession';
import { endVideoCallKeepalive, VIDEO_CALLS_API_V1_BASE } from './videoCallApi';

describe('endVideoCallKeepalive', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.mocked(getToken).mockReturnValue('access-token');
	});

	it('POSTs /end with keepalive and Bearer access token', () => {
		const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		endVideoCallKeepalive('call-9');
		expect(fetchMock).toHaveBeenCalledWith(
			`${VIDEO_CALLS_API_V1_BASE}/call-9/end`,
			expect.objectContaining({
				method: 'POST',
				keepalive: true,
				body: '{}',
			})
		);
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers.authorization).toBe('Bearer access-token');
		expect(JSON.stringify(init)).not.toContain('refresh');
	});

	it('does not fetch without a call id', () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		endVideoCallKeepalive('  ');
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
