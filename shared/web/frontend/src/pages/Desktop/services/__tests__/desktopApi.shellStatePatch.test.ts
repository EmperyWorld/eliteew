/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for thin shell-state GET/PATCH primitives (If-Match, 412 conflict, no retry).
 *
 * Invariants:
 * - Mocks only; no network.
 *
 * Related:
 * - src/pages/Desktop/services/desktopApi.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../../../services/api/client';

const apiClientPatch = vi.hoisted(() => vi.fn());
const apiClientGet = vi.hoisted(() => vi.fn());
const getConditionalJsonEtag = vi.hoisted(() => vi.fn());
const invalidateConditionalJsonKey = vi.hoisted(() => vi.fn());
const logCacheInvalidationMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../services/authSession', () => ({
	authSession: {
		token: 'test-token',
		authenticated: true,
	},
}));

vi.mock('../../../../services/api/client', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../../../services/api/client')>();
	return {
		...actual,
		apiClient: {
			...actual.apiClient,
			patch: apiClientPatch,
			get: apiClientGet,
		},
	};
});

vi.mock(
	'../../../../services/api/conditionalJsonGet',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('../../../../services/api/conditionalJsonGet')
			>();
		return {
			...actual,
			getConditionalJsonEtag,
			invalidateConditionalJsonKey,
		};
	}
);

vi.mock('../../../../services/api/cacheInvalidationLogger', () => ({
	logCacheInvalidation: logCacheInvalidationMock,
}));

import {
	getDesktopShellState,
	isDesktopShellStateConflictError,
	patchDesktopShellState,
	patchDesktopShellStateKeepalive,
	clearDesktopShellStateCache,
	fetchDesktopShellStateDeduplicated,
} from '../desktopApi';
import { setBrowserTabLeaderRole } from '@/utils/browserTabLeaderState';

describe('desktopApi shell-state GET/PATCH primitives', () => {
	beforeEach(() => {
		clearDesktopShellStateCache();
		setBrowserTabLeaderRole('leader');
		apiClientPatch.mockReset();
		apiClientGet.mockReset();
		getConditionalJsonEtag.mockReturnValue(null);
		logCacheInvalidationMock.mockReset();
	});

	afterEach(() => {
		clearDesktopShellStateCache();
	});

	it('getDesktopShellState returns state and etag from response headers', async () => {
		apiClientGet.mockResolvedValueOnce({
			data: { quiet_mode: true },
			headers: {
				etag: '"etag-get"',
				'x-shell-state-field-etags': '{"quiet_mode":"field-qm"}',
			},
		});

		const result = await getDesktopShellState();

		expect(result).toEqual({
			state: { quiet_mode: true },
			etag: '"etag-get"',
			fieldEtags: { quiet_mode: 'field-qm' },
		});
		expect(apiClientGet).toHaveBeenCalledWith(
			'/desktop/shell-state',
			expect.objectContaining({ baseURL: '/api/v1' })
		);
	});

	it('patchDesktopShellState sends single PATCH with If-Match from options', async () => {
		apiClientPatch.mockResolvedValueOnce({
			data: { quiet_mode: true },
			headers: { etag: '"etag-b"' },
		});

		const result = await patchDesktopShellState(
			{ quiet_mode: true },
			{ ifMatch: '"etag-a"' }
		);

		expect(result).toEqual({
			state: { quiet_mode: true },
			etag: '"etag-b"',
			fieldEtags: null,
		});
		expect(apiClientPatch).toHaveBeenCalledTimes(1);
		expect(apiClientPatch).toHaveBeenCalledWith(
			'/desktop/shell-state',
			{ quiet_mode: true },
			expect.objectContaining({
				headers: { 'If-Match': '"etag-a"' },
			})
		);
	});

	it('patchDesktopShellState sends field etags for patched keys after cached GET', async () => {
		apiClientGet.mockResolvedValueOnce({
			data: { quiet_mode: false, windows_snapshot: { windows: [] } },
			headers: {
				etag: '"etag-a"',
				'x-shell-state-field-etags':
					'{"quiet_mode":"field-qm","windows_snapshot":"field-win"}',
			},
		});
		await fetchDesktopShellStateDeduplicated();
		apiClientPatch.mockResolvedValueOnce({
			data: { quiet_mode: true, windows_snapshot: { windows: [] } },
			headers: {
				etag: '"etag-b"',
				'x-shell-state-field-etags':
					'{"quiet_mode":"field-qm-b","windows_snapshot":"field-win"}',
			},
		});

		const result = await patchDesktopShellState(
			{ quiet_mode: true },
			{ ifMatch: '"etag-a"' }
		);

		expect(result.fieldEtags).toEqual({
			quiet_mode: 'field-qm-b',
			windows_snapshot: 'field-win',
		});
		expect(apiClientPatch).toHaveBeenCalledWith(
			'/desktop/shell-state',
			{ quiet_mode: true },
			expect.objectContaining({
				headers: expect.objectContaining({
					'If-Match': '"etag-a"',
					'X-Shell-State-If-Match-Fields': '{"quiet_mode":"field-qm"}',
				}),
			})
		);
	});

	it('412 throws DesktopShellStateConflictError once without retry loop', async () => {
		apiClientPatch.mockRejectedValueOnce(
			new APIError('conflict', 412, undefined, {
				detail: {
					code: 'desktop_shell_state_conflict',
					current_etag: '"fresh"',
					message: 'Desktop shell state changed in another session',
				},
			})
		);

		await expect(
			patchDesktopShellState({ quiet_mode: false }, { ifMatch: '"stale"' })
		).rejects.toSatisfy((error: unknown) => {
			if (!isDesktopShellStateConflictError(error)) return false;
			expect(error.currentEtag).toBe('"fresh"');
			expect(error.serverDetail).toEqual(
				expect.objectContaining({
					code: 'desktop_shell_state_conflict',
					current_etag: '"fresh"',
				})
			);
			return true;
		});

		expect(apiClientPatch).toHaveBeenCalledTimes(1);
		expect(apiClientGet).not.toHaveBeenCalled();
		expect(logCacheInvalidationMock).toHaveBeenCalledWith(
			'shell_state 412 conflict',
			expect.objectContaining({
				currentEtag: '"fresh"',
				code: 'desktop_shell_state_conflict',
			})
		);
	});

	it('500 APIError propagates without conflict wrapping or GET reload', async () => {
		apiClientPatch.mockRejectedValueOnce(
			new APIError('Internal Server Error', 500, undefined, {
				detail: 'boom',
			})
		);

		await expect(
			patchDesktopShellState({ quiet_mode: true }, { ifMatch: '"etag-a"' })
		).rejects.toSatisfy((error: unknown) => {
			expect(error).toBeInstanceOf(APIError);
			expect((error as APIError).statusCode).toBe(500);
			expect(isDesktopShellStateConflictError(error)).toBe(false);
			return true;
		});

		expect(apiClientPatch).toHaveBeenCalledTimes(1);
		expect(apiClientGet).not.toHaveBeenCalled();
		expect(logCacheInvalidationMock).not.toHaveBeenCalledWith(
			'shell_state 412 conflict',
			expect.anything()
		);
	});

	it('malformed 412 detail without current_etag still surfaces conflict error', async () => {
		apiClientPatch.mockRejectedValueOnce(
			new APIError('conflict', 412, undefined, {
				detail: { code: 'desktop_shell_state_conflict' },
			})
		);

		await expect(
			patchDesktopShellState({ quiet_mode: false }, { ifMatch: '"stale"' })
		).rejects.toSatisfy((error: unknown) => {
			return isDesktopShellStateConflictError(error);
		});
		expect(apiClientGet).not.toHaveBeenCalled();
	});

	it('clearDesktopShellStateCache logs cache invalidation', () => {
		clearDesktopShellStateCache();
		expect(logCacheInvalidationMock).toHaveBeenCalledWith(
			'clearDesktopShellStateCache'
		);
	});

	it('keepalive PATCH sends If-Match and invalidates local etag cache', () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal('fetch', fetchMock);
		getConditionalJsonEtag.mockReturnValue('"keepalive-etag"');

		patchDesktopShellStateKeepalive({ recent_app_ids: ['app-a'] });

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('/api/v1/desktop/shell-state'),
			expect.objectContaining({
				method: 'PATCH',
				headers: expect.objectContaining({
					'If-Match': '"keepalive-etag"',
				}),
			})
		);
		expect(invalidateConditionalJsonKey).toHaveBeenCalledWith(
			'desktop:shell-state'
		);

		vi.unstubAllGlobals();
	});

	it('keepalive PATCH is skipped on follower tab', () => {
		setBrowserTabLeaderRole('follower');
		invalidateConditionalJsonKey.mockClear();
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal('fetch', fetchMock);
		getConditionalJsonEtag.mockReturnValue('"keepalive-etag"');

		patchDesktopShellStateKeepalive({ recent_app_ids: ['app-a'] });

		expect(fetchMock).not.toHaveBeenCalled();

		vi.unstubAllGlobals();
		setBrowserTabLeaderRole('leader');
	});
});
