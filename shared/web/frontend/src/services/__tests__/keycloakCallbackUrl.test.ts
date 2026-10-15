/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard against OIDC redirect loops (double login while ?code= is present),
 * kiosk/loopback SSO callback URL scheme (http must stay http), and optional
 * auth-proxy discovery rewrite (local docker only — not default kiosk IdP).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { INTENDED_PAGE_SESSION_KEY } from '@/constants/storageKeys';
import {
	buildBakedPublicOidcDiscoveryDocument,
	getBackendSsoCallbackUrl,
	getBackendSsoRefreshUrl,
	hasPendingAuthorizationCallbackInUrl,
	isLoopbackAuthProxyBase,
	resolveBackendSsoCallbackUrl,
	resolveLoopbackAuthProxyDiscoveryUrl,
	resolvePublicBrowserAuthorizationUrl,
	restorePublicIdpDiscoveryDocument,
	rewriteAuthProxyDiscoveryDocument,
	shouldBakePublicOidcDiscovery,
} from '@/services/keycloak';

describe('rewriteAuthProxyDiscoveryDocument', () => {
	it('rewrites public issuer/endpoints onto loopback auth-proxy base', () => {
		const issuer = new URL('http://127.0.0.1/auth-proxy/realms/empery');
		const out = rewriteAuthProxyDiscoveryDocument(
			issuer,
			{
				issuer: 'https://auth.eliteew.ru/realms/empery',
				authorization_endpoint:
					'https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth',
				token_endpoint:
					'https://auth.eliteew.ru/realms/empery/protocol/openid-connect/token',
			},
			'http://127.0.0.1/auth-proxy'
		);
		expect(out.issuer).toBe('http://127.0.0.1/auth-proxy/realms/empery');
		expect(out.authorization_endpoint).toBe(
			'http://127.0.0.1/auth-proxy/realms/empery/protocol/openid-connect/auth'
		);
		expect(out.token_endpoint).toBe(
			'http://127.0.0.1/auth-proxy/realms/empery/protocol/openid-connect/token'
		);
	});

	it('detects loopback auth-proxy bases', () => {
		expect(isLoopbackAuthProxyBase('http://127.0.0.1/auth-proxy')).toBe(true);
		expect(isLoopbackAuthProxyBase('http://localhost/auth-proxy/')).toBe(true);
		expect(isLoopbackAuthProxyBase('https://auth.eliteew.ru')).toBe(false);
	});
});

describe('restorePublicIdpDiscoveryDocument', () => {
	it('restores nginx-rewritten auth-proxy URLs to public IdP issuer', () => {
		const issuer = new URL('https://auth.eliteew.ru/realms/empery');
		const out = restorePublicIdpDiscoveryDocument(
			issuer,
			{
				issuer: 'http://127.0.0.1/auth-proxy/realms/empery',
				authorization_endpoint:
					'http://127.0.0.1/auth-proxy/realms/empery/protocol/openid-connect/auth',
			},
			'http://127.0.0.1/auth-proxy'
		);
		expect(out.issuer).toBe('https://auth.eliteew.ru/realms/empery');
		expect(out.authorization_endpoint).toBe(
			'https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth'
		);
	});
});

describe('resolveLoopbackAuthProxyDiscoveryUrl', () => {
	const originalLocation = window.location;

	afterEach(() => {
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation,
		});
	});

	it('maps public issuer to same-origin auth-proxy well-known on loopback', () => {
		expect(['127.0.0.1', 'localhost']).toContain(window.location.hostname);
		const url = resolveLoopbackAuthProxyDiscoveryUrl(
			new URL('https://auth.eliteew.ru/realms/empery')
		);
		expect(url?.pathname).toBe(
			'/auth-proxy/realms/empery/.well-known/openid-configuration'
		);
		expect(url?.origin).toBe(window.location.origin);
	});

	it('skips auth-proxy on FoFline fofline-spa opaque origin (hostname localhost)', () => {
		const u = new URL(
			'fofline-spa://localhost/index.html?eliteewFoflineClient=1#desktop'
		);
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: {
				protocol: u.protocol,
				hostname: u.hostname,
				pathname: u.pathname,
				origin: u.origin,
				href: u.href,
				search: u.search,
				host: u.host,
			},
		});
		expect(u.origin).toBe('null');
		expect(
			resolveLoopbackAuthProxyDiscoveryUrl(
				new URL('https://auth.eliteew.ru/realms/empery')
			)
		).toBeNull();
	});
});

describe('getBackendSsoCallbackUrl (FoFline opaque origin)', () => {
	const originalLocation = window.location;

	afterEach(() => {
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: originalLocation,
		});
	});

	it('uses public app API when location origin is opaque fofline-spa', () => {
		const u = new URL('fofline-spa://localhost/index.html');
		Object.defineProperty(window, 'location', {
			configurable: true,
			writable: true,
			value: {
				protocol: u.protocol,
				hostname: u.hostname,
				pathname: u.pathname,
				origin: u.origin,
				href: u.href,
				search: u.search,
				host: u.host,
			},
		});
		expect(getBackendSsoCallbackUrl()).toBe(
			'https://app.eliteew.ru/api/v1/auth/sso/callback'
		);
		expect(getBackendSsoRefreshUrl()).toBe(
			'https://app.eliteew.ru/api/v1/auth/sso/refresh'
		);
		expect(shouldBakePublicOidcDiscovery()).toBe(true);
		const baked = buildBakedPublicOidcDiscoveryDocument(
			new URL('https://auth.eliteew.ru/realms/empery')
		);
		expect(baked.issuer).toBe('https://auth.eliteew.ru/realms/empery');
		expect(baked.authorization_endpoint).toBe(
			'https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth'
		);
	});
});

describe('resolvePublicBrowserAuthorizationUrl', () => {
	it('rewrites loopback auth-proxy auth URL to public HTTPS IdP', () => {
		const out = resolvePublicBrowserAuthorizationUrl(
			'http://127.0.0.1/auth-proxy/realms/empery/protocol/openid-connect/auth?x=1'
		);
		expect(out.origin).toBe('https://auth.eliteew.ru');
		expect(out.pathname).toBe('/realms/empery/protocol/openid-connect/auth');
		expect(out.searchParams.get('x')).toBe('1');
	});

	it('leaves public IdP URLs unchanged', () => {
		const href =
			'https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth';
		expect(resolvePublicBrowserAuthorizationUrl(href).href).toBe(href);
	});
});

describe('resolveBackendSsoCallbackUrl', () => {
	it('keeps http scheme on loopback kiosk origins', () => {
		expect(resolveBackendSsoCallbackUrl('http://127.0.0.1')).toBe(
			'http://127.0.0.1/api/v1/auth/sso/callback'
		);
		expect(resolveBackendSsoCallbackUrl('http://localhost')).toBe(
			'http://localhost/api/v1/auth/sso/callback'
		);
		expect(resolveBackendSsoCallbackUrl('http://127.0.0.1:80')).toBe(
			'http://127.0.0.1/api/v1/auth/sso/callback'
		);
	});

	it('upgrades non-loopback http bases to https', () => {
		expect(resolveBackendSsoCallbackUrl('http://app.eliteew.ru')).toBe(
			'https://app.eliteew.ru/api/v1/auth/sso/callback'
		);
	});

	it('preserves https origins', () => {
		expect(resolveBackendSsoCallbackUrl('https://app.eliteew.ru')).toBe(
			'https://app.eliteew.ru/api/v1/auth/sso/callback'
		);
	});
});

describe('hasPendingAuthorizationCallbackInUrl', () => {
	beforeEach(() => {
		window.history.replaceState(null, '', '/');
		sessionStorage.clear();
	});

	afterEach(() => {
		window.history.replaceState(null, '', '/');
		sessionStorage.clear();
	});

	it('detects authorization code in query string', () => {
		window.history.replaceState(
			null,
			'',
			'/?code=abc&state=xyz&session_state=s1'
		);
		expect(hasPendingAuthorizationCallbackInUrl()).toBe(true);
	});

	it('returns false on mobile download hash without oauth params', () => {
		sessionStorage.setItem(INTENDED_PAGE_SESSION_KEY, 'mobile-app-download');
		window.history.replaceState(null, '', '/#/mobile-app-download');
		expect(hasPendingAuthorizationCallbackInUrl()).toBe(false);
	});
});
