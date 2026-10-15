/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock: concurrent refreshAccessToken joins one in-flight grant
 * (prevents Keycloak refreshTokenMaxReuse=0 session kill).
 *
 * Invariants:
 * - Two parallel refreshAccessToken calls → one refreshTokenGrantRequest.
 *
 * Related:
 * - `keycloakOidcRefreshFlow.ts`, `documentation/product/FRONTEND-AUTH.md`
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const refreshTokenGrantRequest = vi.fn();
const processRefreshTokenResponse = vi.fn();

vi.mock('oauth4webapi', () => ({
	None: () => ({}),
	refreshTokenGrantRequest: (...args: unknown[]) =>
		refreshTokenGrantRequest(...args),
	processRefreshTokenResponse: (...args: unknown[]) =>
		processRefreshTokenResponse(...args),
}));

vi.mock('../keycloakOidcDiscovery', () => ({
	getBackendSsoRefreshUrl: () => 'http://localhost/api/v1/auth/sso/refresh',
	getOidcHttpOptions: () => ({}),
	shouldBakePublicOidcDiscovery: () => false,
}));

vi.mock('../keycloakEmbeddedOidc', () => ({
	accessTokenStillValid: () => false,
	hydrateMobileEmbeddedTokensFromNativeBridge: vi.fn(),
	isMobileEmbeddedOidcContext: () => false,
	refreshAccessTokenViaNativeBridge: vi.fn(),
}));

vi.mock('../keycloakDesktopNativeOidc', () => ({
	hasDesktopNativeOidcBridge: () => false,
	refreshAccessTokenViaDesktopNativeBridge: vi.fn(),
}));

vi.mock('../auth/authSessionLock', () => ({
	isAuthSessionLocked: () => false,
}));

describe('oidcRefreshAccessToken single-flight', () => {
	beforeEach(() => {
		vi.resetModules();
		refreshTokenGrantRequest.mockReset();
		processRefreshTokenResponse.mockReset();
	});

	it('joins concurrent callers onto one refresh_token grant', async () => {
		let releaseGrant!: () => void;
		const grantGate = new Promise<void>((resolve) => {
			releaseGrant = resolve;
		});
		refreshTokenGrantRequest.mockImplementation(async () => {
			await grantGate;
			return new Response('{}');
		});
		processRefreshTokenResponse.mockResolvedValue({
			access_token: 'at-2',
			refresh_token: 'rt-2',
			expires_in: 300,
		});

		const { oidcRefreshAccessToken } = await import(
			'../keycloakOidcRefreshFlow'
		);

		const host = {
			token: 'at-1',
			refreshToken: 'rt-1',
			idToken: 'id-1',
			refreshInFlight: null as Promise<boolean> | null,
			applyTokens: vi.fn(function applyTokens(
				this: { token?: string; refreshToken?: string },
				input: { accessToken?: string; refreshToken?: string }
			) {
				this.token = input.accessToken;
				this.refreshToken = input.refreshToken;
			}),
			persistCurrentTokens: vi.fn(),
			invoke: vi.fn(),
			onAuthRefreshSuccess: vi.fn(),
			onAuthRefreshError: vi.fn(),
			getAuthorizationServer: vi.fn(async () => ({
				issuer: 'https://auth.example/realms/empery',
				token_endpoint: 'https://auth.example/token',
			})),
		};

		const a = oidcRefreshAccessToken(host as never);
		const b = oidcRefreshAccessToken(host as never);
		expect(host.refreshInFlight).toBeTruthy();
		releaseGrant();
		await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
		expect(refreshTokenGrantRequest).toHaveBeenCalledTimes(1);
		expect(refreshTokenGrantRequest.mock.calls[0]?.[3]).toBe('rt-1');
	});
});
