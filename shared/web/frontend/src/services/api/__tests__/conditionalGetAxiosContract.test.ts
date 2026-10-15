/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock: conditionalJsonGet ETag flow must survive axios request interceptors
 * (auth, leader gate) and AuthContext logout must clear session ETag maps.
 *
 * Invariants:
 * - Fails if If-None-Match injection, validateStatus 304, or logout cache clear regress.
 *
 * Related:
 * - `services/api/conditionalJsonGet.ts`, `services/api/client.ts`, `contexts/AuthContext.tsx`
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	AxiosHeaders,
	type AxiosAdapter,
	type AxiosInstance,
	type InternalAxiosRequestConfig,
} from 'axios';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	setBrowserTabLeaderRole,
	setSingleTabPolicyEnabled,
} from '../../../utils/browserTabLeaderState';
import { createAPIClient } from '../client';

const dir = dirname(fileURLToPath(import.meta.url));

const hoisted = vi.hoisted(() => ({
	logCacheInvalidation: vi.fn(),
}));

vi.mock('../../authSession', () => ({
	default: {
		authenticated: true,
		token: 'contract-test-token',
		tokenParsed: { exp: Math.floor(Date.now() / 1000) + 3600 },
		updateToken: vi.fn().mockResolvedValue(true),
		login: vi.fn(),
		logout: vi.fn(),
	},
	notifySessionReplaced: vi.fn(),
}));

vi.mock('../cacheInvalidationLogger', () => ({
	logCacheInvalidation: hoisted.logCacheInvalidation,
}));

vi.mock('../../../utils/logger', () => ({
	log: {
		debug: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
	},
	logUxError: vi.fn(),
}));

vi.mock('../../../utils/tokenCache', () => ({
	getCachedTimeUntilExpiry: () => 9999,
	clearTokenCache: vi.fn(),
}));

vi.mock('../../../utils/authRedirect', () => ({
	beginInteractiveLogin: vi.fn(),
	markSessionReplacedPending: vi.fn(),
	normalizeRedirectUri: (uri: string) => uri,
}));

import { apiClient } from '../client';
import {
	clearFeSessionApiCaches,
	conditionalJsonGet,
	getConditionalJsonEtag,
	invalidateConditionalJsonKey,
} from '../conditionalJsonGet';

const CACHE_KEY = 'contract:etag-demo';
const CONDITIONAL_URL = '/api/v1/friends/overview';
const NON_GATED_URL = '/api/v1/auth/refresh';

function readHeader(
	config: InternalAxiosRequestConfig,
	headerName: string
): string | undefined {
	const headers = config.headers;
	if (!headers) return undefined;
	const canonical = headerName.toLowerCase();
	const fromAxiosHeaders = AxiosHeaders.from(headers).get(headerName);
	if (typeof fromAxiosHeaders === 'string') return fromAxiosHeaders;
	if (Array.isArray(fromAxiosHeaders) && fromAxiosHeaders.length > 0) {
		return fromAxiosHeaders[0];
	}
	if (typeof headers === 'object') {
		for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
			if (k.toLowerCase() !== canonical) continue;
			if (typeof v === 'string') return v;
		}
	}
	return undefined;
}

function makeSequentialAdapter(
	responses: Array<{
		status: number;
		data: unknown;
		headers?: Record<string, string>;
	}>
): { adapter: AxiosAdapter; captured: InternalAxiosRequestConfig[] } {
	const captured: InternalAxiosRequestConfig[] = [];
	let callIndex = 0;
	const adapter: AxiosAdapter = (config) => {
		captured.push(config);
		const slot = responses[callIndex] ?? responses[responses.length - 1];
		callIndex += 1;
		return Promise.resolve({
			data: slot.data,
			status: slot.status,
			statusText: slot.status === 304 ? 'Not Modified' : 'OK',
			headers: slot.headers ?? {},
			config,
			request: {},
		});
	};
	return { adapter, captured };
}

describe('conditional GET axios auth boundary contract', () => {
	let contractClient: AxiosInstance;
	let getSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		hoisted.logCacheInvalidation.mockReset();
		invalidateConditionalJsonKey(CACHE_KEY);
		setSingleTabPolicyEnabled(true);
		setBrowserTabLeaderRole('leader');
	});

	afterEach(() => {
		getSpy?.mockRestore();
		setBrowserTabLeaderRole('leader');
		setSingleTabPolicyEnabled(true);
		invalidateConditionalJsonKey(CACHE_KEY);
	});

	function wireContractClient(
		adapter: AxiosAdapter
	): InternalAxiosRequestConfig[] {
		const captured: InternalAxiosRequestConfig[] = [];
		const wrappingAdapter: AxiosAdapter = (config) => {
			captured.push(config);
			return adapter(config);
		};
		contractClient = createAPIClient({ adapter: wrappingAdapter, baseURL: '' });
		getSpy = vi
			.spyOn(apiClient, 'get')
			.mockImplementation((url, config) => contractClient.get(url, config));
		return captured;
	}

	it('stores etag on 200 and reuses cached body on 304 through axios interceptors', async () => {
		const { adapter } = makeSequentialAdapter([
			{
				status: 200,
				data: { total: 3 },
				headers: { etag: '"etag-contract-1"' },
			},
			{ status: 304, data: '', headers: {} },
		]);
		const captured = wireContractClient(adapter);

		const first = await conditionalJsonGet<{ total: number }>(
			CACHE_KEY,
			CONDITIONAL_URL
		);
		expect(first).toEqual({ total: 3 });
		expect(getConditionalJsonEtag(CACHE_KEY)).toBe('"etag-contract-1"');

		const second = await conditionalJsonGet<{ total: number }>(
			CACHE_KEY,
			CONDITIONAL_URL
		);
		expect(second).toEqual({ total: 3 });
		expect(captured).toHaveLength(2);
		expect(readHeader(captured[1], 'If-None-Match')).toBe('"etag-contract-1"');
		expect(readHeader(captured[1], 'Authorization')).toBe(
			'Bearer contract-test-token'
		);
		expect(hoisted.logCacheInvalidation).toHaveBeenCalledWith(
			'conditionalJsonGet 304 short-circuit',
			expect.objectContaining({ cacheKey: CACHE_KEY, url: CONDITIONAL_URL })
		);
	});

	it('clearFeSessionApiCaches forces a full fetch without If-None-Match', async () => {
		const { adapter } = makeSequentialAdapter([
			{
				status: 200,
				data: { total: 1 },
				headers: { etag: '"etag-before-logout"' },
			},
			{
				status: 200,
				data: { total: 9 },
				headers: { etag: '"etag-after-logout"' },
			},
		]);
		const captured = wireContractClient(adapter);

		await conditionalJsonGet<{ total: number }>(CACHE_KEY, CONDITIONAL_URL);
		expect(getConditionalJsonEtag(CACHE_KEY)).toBe('"etag-before-logout"');

		clearFeSessionApiCaches();
		expect(getConditionalJsonEtag(CACHE_KEY)).toBeNull();

		const afterClear = await conditionalJsonGet<{ total: number }>(
			CACHE_KEY,
			CONDITIONAL_URL
		);
		expect(afterClear).toEqual({ total: 9 });
		expect(captured).toHaveLength(2);
		expect(readHeader(captured[1], 'If-None-Match')).toBeUndefined();
	});

	it('request interceptor preserves If-None-Match on conditional GET config', async () => {
		const captured: InternalAxiosRequestConfig[] = [];
		const adapter: AxiosAdapter = (config) => {
			captured.push(config);
			return Promise.resolve({
				data: { ok: true },
				status: 200,
				statusText: 'OK',
				headers: { etag: '"etag-preserve"' },
				config,
				request: {},
			});
		};
		wireContractClient(adapter);

		await contractClient.get(CONDITIONAL_URL, {
			validateStatus: (status) =>
				(status >= 200 && status < 300) || status === 304,
			headers: { 'If-None-Match': '"etag-preserve"' },
		});

		expect(captured).toHaveLength(1);
		expect(readHeader(captured[0], 'If-None-Match')).toBe('"etag-preserve"');
	});

	it('leader gate blocks gated conditional GET on follower tab but not non-gated path', async () => {
		setBrowserTabLeaderRole('follower');

		const gatedCaptured: InternalAxiosRequestConfig[] = [];
		const gatedAdapter: AxiosAdapter = (config) => {
			gatedCaptured.push(config);
			return Promise.resolve({
				data: { total: 0 },
				status: 200,
				statusText: 'OK',
				headers: {},
				config,
				request: {},
			});
		};
		wireContractClient(gatedAdapter);

		await expect(
			conditionalJsonGet<{ total: number }>(CACHE_KEY, CONDITIONAL_URL)
		).rejects.toSatisfy((err: unknown) => axios.isCancel(err));
		expect(gatedCaptured).toHaveLength(0);

		getSpy.mockRestore();
		const nonGatedCaptured: InternalAxiosRequestConfig[] = [];
		const nonGatedAdapter: AxiosAdapter = (config) => {
			nonGatedCaptured.push(config);
			return Promise.resolve({
				data: { refreshed: true },
				status: 200,
				statusText: 'OK',
				headers: { etag: '"etag-non-gated"' },
				config,
				request: {},
			});
		};
		wireContractClient(nonGatedAdapter);

		const body = await conditionalJsonGet<{ refreshed: boolean }>(
			'contract:non-gated',
			NON_GATED_URL
		);
		expect(body).toEqual({ refreshed: true });
		expect(nonGatedCaptured).toHaveLength(1);
	});
});

describe('AuthContext logout ETag cache contract (source lock)', () => {
	it('logout and auth failure handlers call executeAuthSessionTermination kill switch', () => {
		const authContextSrc = readFileSync(
			join(dir, '../../../contexts/AuthContext.tsx'),
			'utf8'
		);
		expect(authContextSrc).toContain('executeAuthSessionTermination');
		expect(authContextSrc).toContain(
			"from '../services/auth/authSessionCoordinator'"
		);
		expect(authContextSrc).toContain('applyAuthSessionTeardown');
		expect(authContextSrc).toContain('isAuthenticating');
		expect(authContextSrc).toContain('onAuthRefreshError');

		const logoutBlock = authContextSrc.match(
			/const logout = async \(\) => \{[\s\S]*?\n\t\};/
		)?.[0];
		expect(logoutBlock, 'logout function body').toBeTruthy();
		expect(logoutBlock).toContain('applyAuthSessionTeardown');

		const onAuthLogoutBlock = authContextSrc.match(
			/authSession\.onAuthLogout = \(\) => \{[\s\S]*?\n\t\t\};/
		)?.[0];
		expect(onAuthLogoutBlock, 'onAuthLogout handler').toBeTruthy();
		expect(onAuthLogoutBlock).toContain('applyAuthSessionTeardown');

		expect(authContextSrc).toContain(
			'authSession.onAuthError = handleAuthSessionFailure'
		);
		// Continuity W3: browser onAuthRefreshError is deferred to classified
		// terminal teardown (timer / tokenExpired) — not the generic failure handler.
		expect(authContextSrc).toContain('authSession.onAuthRefreshError = () => {');
		expect(authContextSrc).toContain('handleBrowserTerminalRefreshFailure');
	});

	it('conditionalJsonGet injects If-None-Match from stored etag', () => {
		const src = readFileSync(join(dir, '../conditionalJsonGet.ts'), 'utf8');
		expect(src).toContain("'If-None-Match'");
		expect(src).toMatch(/status === 304/);
		expect(src).toContain('clearFeSessionApiCaches');
	});
});
