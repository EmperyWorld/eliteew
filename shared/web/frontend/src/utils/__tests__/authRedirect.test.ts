/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit-тесты нормализации OAuth redirect_uri и единого helper интерактивного входа.
 *
 * Invariants:
 * - Тесты сбрасывают module guard между кейсами, иначе idempotent login блокирует повторные сценарии.
 *
 * Related:
 * - `utils/authRedirect.ts`, `utils/redirectUriNormalize.ts`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INTENDED_PAGE_SESSION_KEY } from '../../constants/storageKeys';

const hoisted = vi.hoisted(() => ({
	authSessionLogin: vi.fn(),
	isAuthSessionAuthenticated: vi.fn(() => false),
}));

vi.mock('../../services/authSession', () => ({
	default: {
		login: hoisted.authSessionLogin,
		authenticated: false,
	},
	isAuthSessionAuthenticated: hoisted.isAuthSessionAuthenticated,
}));

import {
	__resetInteractiveLoginForTests,
	AUTH_AUTO_LOGIN_ATTEMPTED_SESSION_KEY,
	AUTH_EXPLICIT_LOGOUT_PENDING_SESSION_KEY,
	beginInteractiveLogin,
	clearAuthAutoLoginAttempted,
	clearExplicitLogoutPending,
	hasExplicitLogoutPending,
	isInteractiveLoginInFlight,
	markExplicitLogoutPending,
	markSessionReplacedPending,
	normalizeRedirectUri,
	redirectToLoginWithReturnUrl,
} from '../authRedirect';

describe('normalizeRedirectUri', () => {
	it('returns empty string unchanged', () => {
		expect(normalizeRedirectUri('')).toBe('');
	});

	it('strips hash fragment', () => {
		expect(normalizeRedirectUri('https://app.eliteew.ru/path#desktop')).toBe(
			'https://app.eliteew.ru/path'
		);
	});

	it('replaces default API origin with app origin', () => {
		expect(normalizeRedirectUri('https://api.eliteew.ru/api/v1/foo')).toBe(
			'https://app.eliteew.ru/api/v1/foo'
		);
	});

	it('leaves non-API URLs unchanged (except hash strip)', () => {
		expect(normalizeRedirectUri('https://other.example/page#x')).toBe(
			'https://other.example/page'
		);
	});

	it('uses VITE_* origins when set', async () => {
		vi.stubEnv('VITE_APP_ORIGIN', 'https://app.custom.test');
		vi.stubEnv('VITE_API_ORIGIN', 'https://api.custom.test');
		vi.resetModules();
		const { normalizeRedirectUri: normalize } = await import(
			'../redirectUriNormalize'
		);
		expect(normalize('https://api.custom.test/z')).toBe(
			'https://app.custom.test/z'
		);
		vi.unstubAllEnvs();
		vi.resetModules();
	});
});

describe('resolveDefaultOidcRedirectUri (FoFline opaque origin)', () => {
	it('uses HTTPS OIDC bridge for fofline-spa: (WebKitGTK redirect)', async () => {
		const { resolveDefaultOidcRedirectUri, FOFLINE_OIDC_BRIDGE_PATH } =
			await import('../redirectUriNormalize');
		const loc = {
			protocol: 'fofline-spa:',
			hostname: 'localhost',
			pathname: '/index.html',
			origin: 'null',
		};
		expect(resolveDefaultOidcRedirectUri(loc)).toBe(
			`https://app.eliteew.ru${FOFLINE_OIDC_BRIDGE_PATH}`
		);
		expect(resolveDefaultOidcRedirectUri(loc)).not.toMatch(/^null/);
		expect(resolveDefaultOidcRedirectUri(loc)).not.toMatch(/^fofline-spa:/);
	});

	it('keeps Windows fofline-spa.localhost on http(s) callback (no bridge)', async () => {
		const { resolveDefaultOidcRedirectUri } = await import(
			'../redirectUriNormalize'
		);
		expect(
			resolveDefaultOidcRedirectUri({
				protocol: 'http:',
				hostname: 'fofline-spa.localhost',
				pathname: '/index.html',
				origin: 'http://fofline-spa.localhost',
			})
		).toBe('http://fofline-spa.localhost/index.html');
	});

	it('keeps http(s) app origins unchanged', async () => {
		const { resolveDefaultOidcRedirectUri } = await import(
			'../redirectUriNormalize'
		);
		expect(
			resolveDefaultOidcRedirectUri({
				protocol: 'https:',
				hostname: 'app.eliteew.ru',
				pathname: '/',
				origin: 'https://app.eliteew.ru',
			})
		).toBe('https://app.eliteew.ru/');
	});
});

function setLocationFromHref(href: string) {
	const u = new URL(href);
	Object.defineProperty(window, 'location', {
		configurable: true,
		writable: true,
		value: {
			protocol: u.protocol,
			pathname: u.pathname,
			hash: u.hash,
			origin: u.origin,
			href: u.href,
			search: u.search,
			host: u.host,
			hostname: u.hostname,
		},
	});
}

describe('redirectToLoginWithReturnUrl', () => {
	const originalLocation = window.location;

	beforeEach(() => {
		__resetInteractiveLoginForTests();
		hoisted.authSessionLogin.mockClear();
		sessionStorage.clear();
	});

	afterEach(() => {
		sessionStorage.clear();
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation,
		});
	});

	it('on /login calls auth session login with normalized redirect and does not set intended page', async () => {
		setLocationFromHref('https://app.eliteew.ru/login');
		redirectToLoginWithReturnUrl();
		await vi.waitFor(() => {
			expect(hoisted.authSessionLogin).toHaveBeenCalledTimes(1);
		});
		expect(hoisted.authSessionLogin.mock.calls[0][0]).toEqual({
			redirectUri: 'https://app.eliteew.ru/login',
		});
		expect(sessionStorage.getItem(INTENDED_PAGE_SESSION_KEY)).toBeNull();
	});

	it('FoFline fofline-spa opaque origin uses HTTPS OIDC bridge redirect_uri', async () => {
		setLocationFromHref(
			'fofline-spa://localhost/index.html?eliteewFoflineClient=1#desktop'
		);
		redirectToLoginWithReturnUrl();
		await vi.waitFor(() => {
			expect(hoisted.authSessionLogin).toHaveBeenCalledTimes(1);
		});
		expect(hoisted.authSessionLogin).toHaveBeenCalledWith({
			redirectUri: 'https://app.eliteew.ru/fofline-oidc-bridge.html',
		});
	});

	it('on /auth path skips intended page storage', async () => {
		setLocationFromHref('https://app.eliteew.ru/auth/callback');
		redirectToLoginWithReturnUrl();
		await vi.waitFor(() => {
			expect(hoisted.authSessionLogin).toHaveBeenCalled();
		});
		expect(sessionStorage.getItem(INTENDED_PAGE_SESSION_KEY)).toBeNull();
		expect(hoisted.authSessionLogin).toHaveBeenCalledWith({
			redirectUri: 'https://app.eliteew.ru/auth/callback',
		});
	});

	it('stores normalized shell page in sessionStorage and calls login', async () => {
		setLocationFromHref('https://app.eliteew.ru/#admin?tab=a');
		redirectToLoginWithReturnUrl();
		await vi.waitFor(() => {
			expect(hoisted.authSessionLogin).toHaveBeenCalled();
		});
		expect(sessionStorage.getItem(INTENDED_PAGE_SESSION_KEY)).toBe('admin');
		expect(hoisted.authSessionLogin).toHaveBeenCalledWith({
			redirectUri: 'https://app.eliteew.ru/',
		});
	});

	it('normalizes hash with leading slash (e.g. admin)', async () => {
		setLocationFromHref('https://app.eliteew.ru/#/admin');
		redirectToLoginWithReturnUrl();
		await vi.waitFor(() => {
			expect(hoisted.authSessionLogin).toHaveBeenCalled();
		});
		expect(sessionStorage.getItem(INTENDED_PAGE_SESSION_KEY)).toBe('admin');
	});

	it('defaults hash to desktop when empty', async () => {
		setLocationFromHref('https://app.eliteew.ru/');
		redirectToLoginWithReturnUrl();
		await vi.waitFor(() => {
			expect(hoisted.authSessionLogin).toHaveBeenCalled();
		});
		expect(sessionStorage.getItem(INTENDED_PAGE_SESSION_KEY)).toBe('desktop');
	});

	it('still calls auth session login when sessionStorage.setItem throws', async () => {
		setLocationFromHref('https://app.eliteew.ru/#ugs');
		const orig = Storage.prototype.setItem;
		Storage.prototype.setItem = () => {
			throw new Error('quota');
		};
		try {
			redirectToLoginWithReturnUrl();
			await vi.waitFor(() => {
				expect(hoisted.authSessionLogin).toHaveBeenCalledTimes(1);
			});
		} finally {
			Storage.prototype.setItem = orig;
		}
	});
});

describe('beginInteractiveLogin guard policy', () => {
	const originalLocation = window.location;

	beforeEach(() => {
		__resetInteractiveLoginForTests();
		hoisted.authSessionLogin.mockClear();
		hoisted.isAuthSessionAuthenticated.mockReturnValue(false);
		sessionStorage.clear();
		setLocationFromHref('https://app.eliteew.ru/#desktop');
	});

	afterEach(() => {
		sessionStorage.clear();
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation,
		});
	});

	it('manual_login resets in-flight guard and calls auth session login again', async () => {
		hoisted.isAuthSessionAuthenticated.mockReturnValue(true);
		beginInteractiveLogin('api_401');
		expect(isInteractiveLoginInFlight()).toBe(true);
		expect(hoisted.authSessionLogin).toHaveBeenCalledTimes(1);

		hoisted.authSessionLogin.mockClear();
		beginInteractiveLogin('manual_login');
		await vi.waitFor(() => {
			expect(hoisted.authSessionLogin).toHaveBeenCalledTimes(1);
		});
	});

	it('skips background login while session_replaced is pending', () => {
		hoisted.isAuthSessionAuthenticated.mockReturnValue(true);
		markSessionReplacedPending();
		beginInteractiveLogin('api_401');
		expect(hoisted.authSessionLogin).not.toHaveBeenCalled();
		expect(isInteractiveLoginInFlight()).toBe(false);
	});

	it('clearAuthAutoLoginAttempted removes auto-login guard key', () => {
		sessionStorage.setItem(AUTH_AUTO_LOGIN_ATTEMPTED_SESSION_KEY, '1');
		clearAuthAutoLoginAttempted();
		expect(
			sessionStorage.getItem(AUTH_AUTO_LOGIN_ATTEMPTED_SESSION_KEY)
		).toBeNull();
	});

	it('markSessionReplacedPending clears auto-login guard key', () => {
		sessionStorage.setItem(AUTH_AUTO_LOGIN_ATTEMPTED_SESSION_KEY, '1');
		markSessionReplacedPending();
		expect(
			sessionStorage.getItem(AUTH_AUTO_LOGIN_ATTEMPTED_SESSION_KEY)
		).toBeNull();
	});

	it('explicit logout pending blocks auto-login until cleared', () => {
		markExplicitLogoutPending();
		expect(hasExplicitLogoutPending()).toBe(true);
		expect(
			sessionStorage.getItem(AUTH_EXPLICIT_LOGOUT_PENDING_SESSION_KEY)
		).toBe('1');
		clearExplicitLogoutPending();
		expect(hasExplicitLogoutPending()).toBe(false);
	});
});
