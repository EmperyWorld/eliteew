/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop native OIDC adapter: host bridge owns native recovery, browser PKCE
 * remains web-only, and JS never persists a refresh token.
 *
 * Related:
 * - services/keycloakDesktopNativeOidc.ts
 * - services/keycloakOidcLoginFlow.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('oauth4webapi', async (importOriginal) => {
	const actual = await importOriginal<typeof import('oauth4webapi')>();
	return {
		...actual,
		generateRandomState: () => 'state-test',
		generateRandomNonce: () => 'nonce-test',
		generateRandomCodeVerifier: () => 'verifier-test',
		calculatePKCECodeChallenge: vi.fn(async () => 'challenge-test'),
	};
});

import { oidcStartAuthorizationRequest } from '../keycloakOidcLoginFlow';
import { setOidcRuntimeProfile } from '../keycloakProfile';
import type { AuthOidcSessionHost } from '../keycloakOidcSessionShared';
import {
	clearDesktopNativeOidcSessionViaBridge,
	hasDesktopNativeOidcBridge,
	hydrateDesktopNativeTokensFromNativeBridge,
	refreshAccessTokenViaDesktopNativeBridge,
	type EmperyDesktopNativeOidc,
	type WindowWithEmperyDesktopNativeOidc,
} from '../keycloakDesktopNativeOidc';
import {
	clearPersistedKeycloakTokens,
	readPersistedKeycloakTokens,
} from '../keycloakTokenStorage';

function hostStub(): AuthOidcSessionHost {
	const stub = {
		oidcInteractiveRedirectInFlight: false,
		tokenPersistence: 'session' as const,
		getAuthorizationServer: async () =>
			({
				authorization_endpoint:
					'https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth',
			}) as never,
	};
	return stub as unknown as AuthOidcSessionHost;
}

function desktopNativeWindow(): WindowWithEmperyDesktopNativeOidc {
	return window as unknown as WindowWithEmperyDesktopNativeOidc;
}

function installDesktopNativeOidcBridge(bridge: EmperyDesktopNativeOidc): void {
	desktopNativeWindow().EmperyDesktopNativeOidc = bridge;
}

function clearDesktopNativeOidcBridge(): void {
	delete desktopNativeWindow().EmperyDesktopNativeOidc;
}

describe('keycloakDesktopNativeOidc adapter', () => {
	const assignMock = vi.fn();

	beforeEach(() => {
		setOidcRuntimeProfile('desktopNative');
		assignMock.mockReset();
		vi.stubGlobal('location', {
			assign: assignMock,
			href: 'https://app.eliteew.ru/?eliteewDesktopClient=1',
			protocol: 'https:',
			origin: 'https://app.eliteew.ru',
			host: 'app.eliteew.ru',
			hostname: 'app.eliteew.ru',
			pathname: '/',
			search: '?eliteewDesktopClient=1',
			hash: '',
		});
		sessionStorage.clear();
		clearDesktopNativeOidcBridge();
	});

	afterEach(() => {
		clearPersistedKeycloakTokens();
		setOidcRuntimeProfile('web');
		clearDesktopNativeOidcBridge();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('keeps browser PKCE for the web profile when the host bridge is absent', async () => {
		setOidcRuntimeProfile('web');
		expect(hasDesktopNativeOidcBridge()).toBe(false);
		await oidcStartAuthorizationRequest(hostStub(), undefined, false);
		expect(assignMock).toHaveBeenCalledTimes(1);
		expect(String(assignMock.mock.calls[0]?.[0] ?? '')).toContain(
			'response_type=code'
		);
	});

	it('does not bypass native PAR when the desktop host bridge is absent', async () => {
		expect(hasDesktopNativeOidcBridge()).toBe(false);
		await expect(
			oidcStartAuthorizationRequest(hostStub(), undefined, false)
		).rejects.toThrow('Desktop native OIDC bridge is unavailable');
		expect(assignMock).not.toHaveBeenCalled();
	});

	it('does not bypass native PAR when the host injects an empty bootstrap', async () => {
		installDesktopNativeOidcBridge({
			getBootstrapJson: () => JSON.stringify({ ok: false }),
			refreshSessionJson: () => JSON.stringify({ ok: false }),
		});
		expect(hasDesktopNativeOidcBridge()).toBe(false);
		await expect(
			oidcStartAuthorizationRequest(hostStub(), undefined, false)
		).rejects.toThrow('Desktop native OIDC bridge is unavailable');
		expect(assignMock).not.toHaveBeenCalled();
	});

	it('does not assign a browser PKCE URL when the host bridge owns an SPA session', async () => {
		installDesktopNativeOidcBridge({
			getBootstrapJson: () =>
				JSON.stringify({ token: 'access', idToken: 'id' }),
		});
		expect(hasDesktopNativeOidcBridge()).toBe(true);
		const host = hostStub();
		host.authenticated = true;
		host.token = 'access';
		await oidcStartAuthorizationRequest(host, undefined, false);
		expect(assignMock).not.toHaveBeenCalled();
	});

	it('recovers through the native bridge when bootstrap exists but SPA has no session', async () => {
		installDesktopNativeOidcBridge({
			getBootstrapJson: () =>
				JSON.stringify({ token: 'stale-access', idToken: 'id' }),
		});
		expect(hasDesktopNativeOidcBridge()).toBe(true);
		const host = hostStub();
		host.authenticated = false;
		host.onAuthSuccess = vi.fn();
		host.invoke = vi.fn();
		host.refreshAccessToken = vi.fn(async () => {
			host.authenticated = true;
			host.token = 'access-refreshed';
			return true;
		});
		await expect(
			oidcStartAuthorizationRequest(host, undefined, false)
		).resolves.toBe('skipped_native_session');
		expect(host.refreshAccessToken).toHaveBeenCalledTimes(1);
		expect(host.invoke).toHaveBeenCalledWith(host.onAuthSuccess);
		expect(assignMock).not.toHaveBeenCalled();
	});

	it('fails closed without browser redirect when native bridge recovery fails', async () => {
		installDesktopNativeOidcBridge({
			getBootstrapJson: () =>
				JSON.stringify({ token: 'stale-access', idToken: 'id' }),
		});
		const host = hostStub();
		host.authenticated = false;
		host.refreshAccessToken = vi.fn(async () => {
			throw new Error('refresh denied');
		});
		await expect(
			oidcStartAuthorizationRequest(host, undefined, false)
		).rejects.toThrow('Desktop native OIDC session could not be restored');
		expect(assignMock).not.toHaveBeenCalled();
	});

	it('hydrates access/id and discards a mistaken refresh token', () => {
		installDesktopNativeOidcBridge({
			getBootstrapJson: () =>
				JSON.stringify({
					token: 'access-native',
					idToken: 'id-native',
					refreshToken: 'must-not-persist',
				}),
		});
		hydrateDesktopNativeTokensFromNativeBridge();
		const stored = readPersistedKeycloakTokens({ allowAccessOnly: true });
		expect(stored?.token).toBe('access-native');
		expect(stored?.idToken).toBe('id-native');
		expect(stored?.refreshToken).toBeUndefined();
		expect(
			sessionStorage.getItem('eliteew.keycloak.desktopNative.oidcTokens.v1') ??
				''
		).not.toContain('must-not-persist');
	});

	it('refreshes via the host bridge without returning a refresh token', async () => {
		installDesktopNativeOidcBridge({
			refreshSessionJson: () =>
				JSON.stringify({
					ok: true,
					token: 'access-2',
					idToken: 'id-2',
					refreshToken: 'still-discard',
				}),
		});
		const tokens = await refreshAccessTokenViaDesktopNativeBridge();
		expect(tokens.accessToken).toBe('access-2');
		expect(tokens.idToken).toBe('id-2');
		expect(tokens).not.toHaveProperty('refreshToken');
	});

	it('clears native session via logoutSessionJson when present', async () => {
		const logout = vi.fn(async () => JSON.stringify({ ok: false }));
		installDesktopNativeOidcBridge({
			logoutSessionJson: logout,
		});
		await clearDesktopNativeOidcSessionViaBridge();
		expect(logout).toHaveBeenCalledTimes(1);
	});

	it('fails closed when logoutSessionJson reports an error (no fake SPA logout)', async () => {
		installDesktopNativeOidcBridge({
			logoutSessionJson: async () =>
				JSON.stringify({ ok: false, error: 'native_ipc_unavailable' }),
		});
		await expect(clearDesktopNativeOidcSessionViaBridge()).rejects.toThrow(
			'native_ipc_unavailable'
		);
	});

	it('no-ops logout when logoutSessionJson is absent', async () => {
		await expect(
			clearDesktopNativeOidcSessionViaBridge()
		).resolves.toBeUndefined();
	});
});
