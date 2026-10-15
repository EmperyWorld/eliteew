/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for API client helpers and streaming fetch guardrails.
 *
 * Invariants:
 * - Authenticated fetch helpers must not attach Bearer headers to non-API or external URLs.
 *
 * Related:
 * - src/services/api/client.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	FOLLOWER_TAB_PASSIVE_MODE,
	setBrowserTabLeaderRole,
	setSingleTabPolicyEnabled,
} from '../../../utils/browserTabLeaderState';
import { resetAuthSessionLockForTests } from '../../auth/authSessionLock';
import { apiFetchWithAuth, buildQueryString, unwrapApiData } from '../client';

const authState = vi.hoisted(() => ({
	authenticated: true,
	token: 'token-initial',
	updateToken: vi.fn(async () => true),
	logout: vi.fn(),
}));

vi.mock('../../authSession', () => ({
	default: authState,
	notifySessionReplaced: vi.fn(),
}));

vi.mock('../../auth/authSessionHttpAbort', () => ({
	registerActiveRequestAbortController: (signal?: AbortSignal) => ({
		signal: signal ?? new AbortController().signal,
		release: vi.fn(),
	}),
}));

vi.mock('../../../utils/tokenCache', () => ({
	clearTokenCache: vi.fn(),
}));

describe('unwrapApiData', () => {
	it('unwraps envelope with success flag', () => {
		const payload = { data: { id: '1', name: 'x' }, success: true };
		expect(unwrapApiData<{ id: string; name: string }>(payload)).toEqual({
			id: '1',
			name: 'x',
		});
	});

	it('unwraps envelope with message field', () => {
		const payload = { data: 42, message: 'ok' };
		expect(unwrapApiData<number>(payload)).toBe(42);
	});

	it('does not unwrap when only data key without success/message', () => {
		const payload = { data: { nested: true }, meta: {} };
		expect(unwrapApiData<typeof payload>(payload)).toEqual(payload);
	});

	it('returns primitives as-is', () => {
		expect(unwrapApiData<string>('plain')).toBe('plain');
	});

	it('returns plain object without envelope shape as-is', () => {
		const o = { items: [1, 2] };
		expect(unwrapApiData<typeof o>(o)).toEqual(o);
	});
});

describe('buildQueryString', () => {
	it('builds query with scalars', () => {
		expect(buildQueryString({ a: 1, b: 'two' })).toBe('?a=1&b=two');
	});

	it('omits undefined and null', () => {
		expect(buildQueryString({ a: 1, b: undefined, c: null })).toBe('?a=1');
	});

	it('encodes array as repeated keys', () => {
		const q = buildQueryString({ tag: ['x', 'y'] });
		expect(q).toContain('tag=x');
		expect(q).toContain('tag=y');
	});

	it('returns empty string for empty params', () => {
		expect(buildQueryString({})).toBe('');
	});
});

describe('apiFetchWithAuth', () => {
	beforeEach(() => {
		setSingleTabPolicyEnabled(true);
		setBrowserTabLeaderRole('leader');
		authState.authenticated = true;
		authState.token = 'token-initial';
		authState.updateToken.mockReset();
		authState.updateToken.mockResolvedValue(true);
		resetAuthSessionLockForTests();
	});

	afterEach(() => {
		setBrowserTabLeaderRole('leader');
		setSingleTabPolicyEnabled(true);
		resetAuthSessionLockForTests();
		vi.restoreAllMocks();
	});

	it('rejects external URLs before adding auth headers', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await expect(
			apiFetchWithAuth('https://evil.example/api/x')
		).rejects.toThrow('configured API /api/*');
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('rejects same-origin non-api paths', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await expect(apiFetchWithAuth('/assets/app.js')).rejects.toThrow(
			'configured API /api/*'
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('blocks gated mutation from follower tab before fetch', async () => {
		setBrowserTabLeaderRole('follower');
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await expect(
			apiFetchWithAuth('/api/v1/ewa/companion/chat/stream', {
				method: 'POST',
				body: '{}',
			})
		).rejects.toThrow(FOLLOWER_TAB_PASSIVE_MODE);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('allows gated mutation from leader tab', async () => {
		setBrowserTabLeaderRole('leader');
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('ok', { status: 200 }));
		await apiFetchWithAuth('/api/v1/ewa/companion/chat/stream', {
			method: 'POST',
			body: '{}',
		});
		expect(fetchSpy).toHaveBeenCalledWith(
			'/api/v1/ewa/companion/chat/stream',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('allows gated GET from follower tab (read-only)', async () => {
		setBrowserTabLeaderRole('follower');
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('{}', { status: 200 }));
		await apiFetchWithAuth('/api/v1/desktop/shell-state', { method: 'GET' });
		expect(fetchSpy).toHaveBeenCalled();
	});

	it('401 triggers token refresh and retries once with updated Bearer token', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		fetchSpy
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ reason: 'token_expired', action: 'refresh' }),
					{
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					}
				)
			)
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		authState.updateToken.mockImplementation(async () => {
			authState.token = 'token-refreshed';
			return true;
		});

		const response = await apiFetchWithAuth('/api/v1/content/abc/download', {
			method: 'GET',
		});

		expect(response.status).toBe(200);
		expect(authState.updateToken).toHaveBeenCalledTimes(1);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		const secondHeaders = new Headers(fetchSpy.mock.calls[1]?.[1]?.headers);
		expect(secondHeaders.get('Authorization')).toBe('Bearer token-refreshed');
	});

	it('403 returns immediately without refresh retry loop', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ detail: 'insufficient_credits' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' },
			})
		);

		const response = await apiFetchWithAuth('/api/v1/content/abc/download', {
			method: 'GET',
		});

		expect(response.status).toBe(403);
		expect(authState.updateToken).not.toHaveBeenCalled();
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});
});
