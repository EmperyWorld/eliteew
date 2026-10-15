/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit-тесты auth/retry веток Axios client interceptors: 401 refresh, 403 login action и retry policy.
 *
 * Invariants:
 * - Интерактивный login проверяется через единый `beginInteractiveLogin`, не legacy redirect helper.
 *
 * Related:
 * - `services/api/client.ts`, `utils/authRedirect.ts`
 */

import {
	AxiosError,
	AxiosHeaders,
	type AxiosAdapter,
	type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMaintenanceStatus } from '../../../services/maintenance/maintenanceState';
import {
	createAPIClient,
	resetSessionReplaceConfirmationStateForTests,
	resetSessionReplacedHandlingStateForTests,
} from '../client';
import {
	markSessionReplaceConfirmedWindow,
	peekSessionReplaceXorPartner,
} from '../../auth/ssoSessionReplaceConfirm';

const hoisted = vi.hoisted(() => ({
	beginInteractiveLogin: vi.fn(),
	notifySessionReplaced: vi.fn(),
	showSessionReplacedToast: vi.fn(),
	publishUnplannedMaintenanceFromHttpError: vi.fn(),
}));

vi.mock('../../maintenance/recoveryNotificationGuard', () => ({
	publishUnplannedMaintenanceFromHttpError:
		hoisted.publishUnplannedMaintenanceFromHttpError,
}));

vi.mock('../../authSession', () => ({
	default: {
		authenticated: true,
		token: 'test-access-token',
		tokenParsed: { exp: Math.floor(Date.now() / 1000) + 3600 },
		updateToken: vi.fn().mockResolvedValue(true),
		login: vi.fn(),
		logout: vi.fn(),
	},
	notifySessionReplaced: hoisted.notifySessionReplaced,
}));

vi.mock('../../auth/sessionAuthToasts', () => ({
	showSessionReplacedToast: hoisted.showSessionReplacedToast,
}));

/** Paths from __tests__/: ../../ = api, ../../../ = src */
vi.mock('../../../utils/authRedirect', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../../utils/authRedirect')>();
	return {
		...actual,
		beginInteractiveLogin: hoisted.beginInteractiveLogin,
	};
});

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

function makeAxiosError(
	config: InternalAxiosRequestConfig,
	status: number,
	data?: unknown
): AxiosError {
	const err = new AxiosError(`Request failed with status code ${status}`);
	err.config = config;
	err.response = {
		status,
		data: data ?? {},
		statusText: status === 429 ? 'Too Many Requests' : 'Error',
		headers: {},
		config: config as InternalAxiosRequestConfig,
	};
	return err;
}

function okResponse(
	config: InternalAxiosRequestConfig,
	data: unknown
): ReturnType<AxiosAdapter> {
	return Promise.resolve({
		data,
		status: 200,
		statusText: 'OK',
		headers: {},
		config,
		request: {},
	});
}

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

describe('createAPIClient response interceptors', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		vi.useRealTimers();
		sessionStorage.clear();
		resetSessionReplaceConfirmationStateForTests();
		resetSessionReplacedHandlingStateForTests();
		clearMaintenanceStatus();
		hoisted.beginInteractiveLogin.mockClear();
		hoisted.notifySessionReplaced.mockClear();
		hoisted.showSessionReplacedToast.mockClear();
		hoisted.publishUnplannedMaintenanceFromHttpError.mockClear();
		const authSession = (await import('../../authSession')).default;
		authSession.authenticated = true;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('retries GET on 408 then succeeds', async () => {
		let n = 0;
		const adapter: AxiosAdapter = (config) => {
			n += 1;
			if (n === 1) {
				return Promise.reject(makeAxiosError(config, 408, {}));
			}
			return okResponse(config, { ok: true });
		};

		vi.useFakeTimers({ shouldAdvanceTime: true });
		const client = createAPIClient({ adapter, baseURL: '' });
		const p = client.get('/api/v1/ping');
		await vi.advanceTimersByTimeAsync(2000);
		const res = await p;
		expect(res.data).toEqual({ ok: true });
		expect(n).toBe(2);
	});

	it('does not retry GET on 429 (no Retry-After — avoids amplifying rate limits)', async () => {
		let n = 0;
		const adapter: AxiosAdapter = (config) => {
			n += 1;
			return Promise.reject(makeAxiosError(config, 429, {}));
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(client.get('/api/v1/ping')).rejects.toMatchObject({
			name: 'APIError',
			statusCode: 429,
		});
		expect(n).toBe(1);
	});

	it('does not retry PUT on 429 (no Retry-After — avoids amplifying rate limits)', async () => {
		let n = 0;
		const adapter: AxiosAdapter = (config) => {
			n += 1;
			return Promise.reject(makeAxiosError(config, 429, {}));
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(
			client.put('/api/v1/resource', { x: 1 })
		).rejects.toMatchObject({
			name: 'APIError',
			statusCode: 429,
		});
		expect(n).toBe(1);
	});

	it('does not retry POST on 429', async () => {
		let n = 0;
		const adapter: AxiosAdapter = (config) => {
			n += 1;
			return Promise.reject(makeAxiosError(config, 429, {}));
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(client.post('/api/v1/ping', {})).rejects.toMatchObject({
			name: 'APIError',
			statusCode: 429,
		});
		expect(n).toBe(1);
	});

	it('retries GET once on 500 then surfaces error', async () => {
		vi.useRealTimers();
		let n = 0;
		const adapter: AxiosAdapter = (config) => {
			n += 1;
			return Promise.reject(
				makeAxiosError(config, 500, { detail: 'Internal' })
			);
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(client.get('/api/v1/ping')).rejects.toMatchObject({
			name: 'APIError',
			statusCode: 500,
		});
		expect(n).toBe(2);
	}, 15_000);

	it('does not retry GET on 503 when response reason is db_schema_migration', async () => {
		let n = 0;
		const adapter: AxiosAdapter = (config) => {
			n += 1;
			return Promise.reject(
				makeAxiosError(config, 503, {
					reason: 'db_schema_migration',
					detail: 'Apply SQL migrations listed in api error detail.',
				})
			);
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(
			client.get('/api/v1/professional-worlds/media/albums')
		).rejects.toMatchObject({
			name: 'APIError',
			statusCode: 503,
		});
		expect(n).toBe(1);
	});

	it('does not treat sso_registry_unavailable 503 as unplanned maintenance', async () => {
		const adapter: AxiosAdapter = (config) =>
			Promise.reject(
				makeAxiosError(config, 503, {
					error: 'service_unavailable',
					reason: 'sso_registry_unavailable',
					action: 'retry',
					detail: 'SSO session registry temporarily unavailable',
				})
			);

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(client.get('/api/v1/profile/me')).rejects.toMatchObject({
			name: 'APIError',
			statusCode: 503,
		});
		expect(
			hoisted.publishUnplannedMaintenanceFromHttpError
		).not.toHaveBeenCalled();
	});

	it('calls beginInteractiveLogin on 403 when auth body requests login', async () => {
		const adapter: AxiosAdapter = (config) => {
			return Promise.reject(
				makeAxiosError(config, 403, {
					detail: {
						reason: 'forbidden',
						action: 'login',
						error: 'forbidden',
					},
				})
			);
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(client.get('/api/v1/ping')).rejects.toThrow();
		expect(hoisted.beginInteractiveLogin).toHaveBeenCalledTimes(1);
	});

	it('does not redirect on 403 for desktop AI chat paths (business rules)', async () => {
		const adapter: AxiosAdapter = (config) => {
			return Promise.reject(
				makeAxiosError(config, 403, {
					detail: {
						reason: 'forbidden',
						action: 'login',
						error: 'forbidden',
					},
				})
			);
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(
			client.post('/api/v1/desktop/ai-chat/chats/stream', {})
		).rejects.toThrow();
		expect(hoisted.beginInteractiveLogin).not.toHaveBeenCalled();
	});

	it('skips unauthenticated API requests without starting interactive login', async () => {
		const authSession = (await import('../../authSession')).default;
		authSession.authenticated = false;

		const adapter: AxiosAdapter = (config) => okResponse(config, { ok: true });

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(client.get('/api/v1/ping')).rejects.toThrow(
			'User not authenticated - request skipped'
		);
		expect(hoisted.beginInteractiveLogin).not.toHaveBeenCalled();
	});

	it('redirects to login on 401 when backend says token_missing (no refresh path)', async () => {
		const adapter: AxiosAdapter = (config) => {
			return Promise.reject(
				makeAxiosError(config, 401, {
					detail: {
						reason: 'token_missing',
						action: 'login',
						error: 'unauthorized',
					},
				})
			);
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(client.get('/api/v1/ping')).rejects.toThrow();
		expect(hoisted.beginInteractiveLogin).toHaveBeenCalledTimes(1);
	});

	it('retries 409 session replace confirmation with header and keeps short follow-up window', async () => {
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
		const seenConfirmHeaders: Array<string | undefined> = [];
		let n = 0;
		const adapter: AxiosAdapter = (config) => {
			n += 1;
			seenConfirmHeaders.push(readHeader(config, 'X-SSO-Replace-Confirm'));
			if (n === 1) {
				return Promise.reject(
					makeAxiosError(config, 409, {
						error: 'unauthorized',
						reason: 'session_replace_confirmation_required',
						action: 'login',
						detail: 'Confirm replacing active browser session',
						xor_partner: 'fofline',
					})
				);
			}
			return okResponse(config, { ok: true, n });
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		const first = await client.get('/api/v1/profile/me');
		expect(first.data).toEqual({ ok: true, n: 2 });
		// 409 XOR path must arm partner before confirm (dialog / toast copy).
		expect(peekSessionReplaceXorPartner()).toBe('fofline');
		const second = await client.get('/api/v1/profile/preferences');
		expect(second.data).toEqual({ ok: true, n: 3 });

		expect(confirmSpy).toHaveBeenCalledTimes(1);
		expect(seenConfirmHeaders[0]).toBeUndefined();
		expect(seenConfirmHeaders[1]).toBe('1');
		expect(seenConfirmHeaders[2]).toBe('1');
	});

	it('adds X-SSO-Replace-Confirm on API requests while replace window is active', async () => {
		markSessionReplaceConfirmedWindow();
		let seenConfirm: string | undefined;
		const adapter: AxiosAdapter = (config) => {
			seenConfirm = readHeader(config, 'X-SSO-Replace-Confirm');
			return okResponse(config, { ok: true });
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		const res = await client.get('/api/v1/profile/me');
		expect(res.data).toEqual({ ok: true });
		expect(seenConfirm).toBe('1');
	});

	it('parallel 409 session replace prompts once and retries all requests', async () => {
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
		const adapter: AxiosAdapter = (config) => {
			if (!readHeader(config, 'X-SSO-Replace-Confirm')) {
				return Promise.reject(
					makeAxiosError(config, 409, {
						error: 'unauthorized',
						reason: 'session_replace_confirmation_required',
						action: 'login',
					})
				);
			}
			return okResponse(config, { ok: true, url: config.url });
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		const [a, b, c] = await Promise.all([
			client.get('/api/v1/profile/me'),
			client.get('/api/v1/gaf-chat/chats'),
			client.get('/api/v1/desktop/shell-state'),
		]);
		expect(a.data).toEqual({ ok: true, url: '/api/v1/profile/me' });
		expect(b.data).toEqual({ ok: true, url: '/api/v1/gaf-chat/chats' });
		expect(c.data).toEqual({ ok: true, url: '/api/v1/desktop/shell-state' });
		expect(confirmSpy).toHaveBeenCalledTimes(1);
	});

	it('retries GET once on ERR_NETWORK_CHANGED then succeeds', async () => {
		let n = 0;
		const adapter: AxiosAdapter = (config) => {
			n += 1;
			if (n === 1) {
				const err = new AxiosError('Network Error: ERR_NETWORK_CHANGED');
				err.config = config;
				return Promise.reject(err);
			}
			return okResponse(config, { ok: true });
		};

		vi.useFakeTimers({ shouldAdvanceTime: true });
		const client = createAPIClient({ adapter, baseURL: '' });
		const p = client.get('/api/v1/ping');
		await vi.advanceTimersByTimeAsync(2000);
		const res = await p;
		expect(res.data).toEqual({ ok: true });
		expect(n).toBe(2);
	});

	it('retries once after refresh path on 401 when refresh succeeds', async () => {
		const authSession = (await import('../../authSession')).default;
		let n = 0;
		const adapter: AxiosAdapter = (config) => {
			n += 1;
			if (n === 1) {
				return Promise.reject(
					makeAxiosError(config, 401, {
						detail: {
							reason: 'token_expired',
							action: 'refresh',
							error: 'unauthorized',
						},
					})
				);
			}
			return okResponse(config, { recovered: true });
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		const res = await client.get('/api/v1/ping');
		expect(res.data).toEqual({ recovered: true });
		expect(n).toBe(2);
		expect(authSession.updateToken).toHaveBeenCalled();
	});

	it('retries on 401 when token_expired but action=login (legacy API body)', async () => {
		const authSession = (await import('../../authSession')).default;
		let n = 0;
		const adapter: AxiosAdapter = (config) => {
			n += 1;
			if (n === 1) {
				return Promise.reject(
					makeAxiosError(config, 401, {
						detail: {
							reason: 'token_expired',
							action: 'login',
							error: 'unauthorized',
						},
					})
				);
			}
			return okResponse(config, { recovered: true });
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		const res = await client.get('/api/v1/ping');
		expect(res.data).toEqual({ recovered: true });
		expect(authSession.updateToken).toHaveBeenCalled();
	});

	it('throws APIError for expected 404 on dashboard active layout without extra redirect', async () => {
		const adapter: AxiosAdapter = (config) => {
			return Promise.reject(
				makeAxiosError(config, 404, { detail: 'No active layout' })
			);
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(
			client.get('/api/v1/dashboard/layouts/active')
		).rejects.toMatchObject({
			name: 'APIError',
			statusCode: 404,
		});
	});

	it('throws APIError for missing unified content download without auth redirect toast path', async () => {
		const adapter: AxiosAdapter = (config) => {
			return Promise.reject(
				makeAxiosError(config, 404, { detail: 'Content not found' })
			);
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(
			client.get(
				'/api/v1/content/970e23a2-b9aa-42ff-9dee-acccf0c0b8ba/download'
			)
		).rejects.toMatchObject({
			name: 'APIError',
			statusCode: 404,
		});
	});

	it('extracts message from 402 body when server puts HTTPException.detail in `error` (main.py)', async () => {
		const adapter: AxiosAdapter = (config) => {
			return Promise.reject(
				makeAxiosError(config, 402, {
					error: {
						message: 'Недостаточно EW для подписки на это приложение',
						ew_balance: 100,
						required: 200,
						app_id: 'app-video-studio',
					},
					status_code: 402,
				})
			);
		};

		const client = createAPIClient({ adapter, baseURL: '' });
		await expect(
			client.post('/api/v1/desktop/installed')
		).rejects.toMatchObject({
			name: 'APIError',
			statusCode: 402,
			message: 'Недостаточно EW для подписки на это приложение',
		});
	});

	it('handles session_replaced once when parallel requests fail with 401', async () => {
		const adapter: AxiosAdapter = (config) =>
			Promise.reject(
				makeAxiosError(config, 401, {
					reason: 'session_replaced',
					action: 'login',
				})
			);

		const client = createAPIClient({ adapter, baseURL: '' });
		await Promise.allSettled([
			client.get('/api/v1/profile/me'),
			client.get('/api/v1/profile/preferences'),
			client.get('/api/v1/desktop/shell-state'),
		]);

		expect(hoisted.notifySessionReplaced).toHaveBeenCalledTimes(1);
		expect(hoisted.showSessionReplacedToast).toHaveBeenCalledTimes(1);
		expect(
			sessionStorage.getItem('eliteew.auth.sessionReplacedPending.v1')
		).toBe('1');
		expect(hoisted.beginInteractiveLogin).not.toHaveBeenCalled();
	});
});

describe('APIError', () => {
	it('exposes getters for status classification', async () => {
		const { APIError } = await import('../client');
		const network = new APIError('net', 0, 'NETWORK_ERROR');
		expect(network.isNetworkError).toBe(true);
		const clientErr = new APIError('nope', 404);
		expect(clientErr.isClientError).toBe(true);
		expect(clientErr.isServerError).toBe(false);
		const srv = new APIError('x', 503);
		expect(srv.isServerError).toBe(true);
		const auth = new APIError('a', 401);
		expect(auth.isAuthError).toBe(true);
	});
});
